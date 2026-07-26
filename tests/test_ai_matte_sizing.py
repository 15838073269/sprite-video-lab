import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

import server


class AiMatteSizingTests(unittest.TestCase):
    def test_clear_runtime_files_requires_confirmation_and_stays_inside_managed_dirs(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            work_dir = Path(temp_dir) / "work"
            managed_dirs = tuple(work_dir / name for name in ("uploads", "jobs", "exports"))
            for directory in managed_dirs:
                directory.mkdir(parents=True)
                (directory / "generated.bin").write_bytes(b"generated")
            settings_path = work_dir / "settings.json"
            settings_path.write_text('{"keep": true}', encoding="utf-8")
            unmanaged_path = work_dir / "manual-output"
            unmanaged_path.mkdir()
            (unmanaged_path / "keep.bin").write_bytes(b"keep")
            external_export_root = Path(temp_dir) / "external-exports"
            external_export_root.mkdir()
            generated_export = external_export_root / "20260721-120000-abcd-export"
            generated_export.mkdir()
            (generated_export / "generated.mov").write_bytes(b"generated")
            downloaded_copy = external_export_root / "downloaded-copy.mov"
            downloaded_copy.write_bytes(b"keep")

            with (
                mock.patch.object(server, "WORK_DIR", work_dir),
                mock.patch.object(server, "EXPORTS_DIR", managed_dirs[2]),
                mock.patch.object(server, "MANAGED_RUNTIME_DIRS", managed_dirs),
                mock.patch.object(server, "configured_exports_dir", return_value=external_export_root),
            ):
                with self.assertRaises(ValueError):
                    server.clear_managed_runtime_files(False)
                self.assertTrue((managed_dirs[0] / "generated.bin").exists())

                result = server.clear_managed_runtime_files(True)

            self.assertEqual(result["cleared"], ["uploads", "jobs", "exports"])
            self.assertEqual(result["cleared_export_directories"], [generated_export.name])
            self.assertTrue(all(directory.is_dir() and not any(directory.iterdir()) for directory in managed_dirs))
            self.assertTrue(settings_path.exists())
            self.assertTrue((unmanaged_path / "keep.bin").exists())
            self.assertFalse(generated_export.exists())
            self.assertTrue(downloaded_copy.exists())

    def test_auto_ai_resolution_uses_area_for_wide_images(self):
        image = Image.new("RGBA", (2048, 768))

        self.assertEqual(server.auto_ai_resolution_for_image(image), 1248)

    def test_auto_ai_resolution_preserves_small_image_floor(self):
        image = Image.new("RGBA", (320, 180))

        self.assertEqual(server.auto_ai_resolution_for_image(image), 1024)

    def test_auto_ai_resolution_caps_large_images(self):
        image = Image.new("RGBA", (4096, 4096))

        self.assertEqual(server.auto_ai_resolution_for_image(image), 2560)

    def test_birefnet_input_resize_does_not_letterbox_wide_images(self):
        image = Image.new("RGB", (2048, 768), (210, 20, 30))

        resized = server.resize_birefnet_input(image, 128)

        self.assertEqual(resized.size, (128, 128))
        self.assertEqual(resized.getpixel((0, 0)), (210, 20, 30))
        self.assertEqual(resized.getpixel((127, 0)), (210, 20, 30))
        self.assertEqual(resized.getpixel((0, 127)), (210, 20, 30))
        self.assertEqual(resized.getpixel((127, 127)), (210, 20, 30))

    def test_auto_key_color_uses_dominant_border_color_not_corner_average(self):
        image = Image.new("RGBA", (128, 64), (255, 255, 255, 255))
        for y in range(40, 64):
            for x in range(128):
                image.putpixel((x, y), (35, 40, 45, 255))

        self.assertEqual(server.auto_key_color(image), (255, 255, 255))

    def test_auto_key_color_prefers_large_green_screen_inside_dark_frame(self):
        image = Image.new("RGBA", (128, 64), (1, 1, 1, 255))
        for y in range(12, 56):
            for x in range(20, 118):
                image.putpixel((x, y), (0, 255, 0, 255))

        self.assertEqual(server.auto_key_color(image), (0, 255, 0))

    def test_solid_background_fallback_accepts_low_confidence_ai_mask(self):
        image = Image.new("RGBA", (128, 64), (255, 255, 255, 255))
        for y in range(24, 64):
            for x in range(128):
                image.putpixel((x, y), (35, 40, 45, 255))
        ai_score = {
            "max_alpha": 245,
            "mean_alpha": 20.0,
            "visible_ratio": 0.7,
            "strong_ratio": 0.008,
        }

        fallback = server.solid_background_fallback_alpha(image, ai_score, 42, 8)

        self.assertIsNotNone(fallback)
        alpha, info = fallback
        self.assertEqual(info["solid_key_color"], "#FFFFFF")
        self.assertEqual(alpha.getpixel((64, 0)), 0)
        self.assertEqual(alpha.getpixel((64, 63)), 255)

    def test_luma_auto_direction_uses_white_background_as_transparent(self):
        image = Image.new("RGBA", (3, 1), (255, 255, 255, 255))
        image.putpixel((1, 0), (220, 0, 20, 255))
        image.putpixel((2, 0), (0, 0, 0, 255))

        polarity = server.resolve_luma_polarity("auto", (255, 255, 255))
        alpha = server.luminance_alpha_mask(image, 0, 85, 0.55, 1.7, polarity=polarity)

        self.assertEqual(polarity, "dark")
        self.assertEqual(alpha.getpixel((0, 0)), 0)
        self.assertGreater(alpha.getpixel((1, 0)), 200)
        self.assertEqual(alpha.getpixel((2, 0)), 255)

    def test_luma_auto_direction_uses_black_background_as_transparent(self):
        self.assertEqual(server.resolve_luma_polarity("auto", (0, 0, 0)), "bright")

    def test_auto_video_preserves_source_canvas_by_default(self):
        self.assertTrue(server.should_preserve_source_canvas("video", 0, "auto"))
        self.assertTrue(server.should_preserve_source_canvas("video", 1, "auto"))
        self.assertTrue(server.should_preserve_source_canvas("video", 0, "square_bottom"))
        self.assertEqual(server.effective_canvas_settings("video", 24, "square_center"), (0, "auto"))

    def test_source_canvas_resize_keeps_video_frame_dimensions(self):
        first = Image.new("RGBA", (96, 54), (0, 0, 0, 0))
        second = Image.new("RGBA", (96, 54), (0, 0, 0, 0))
        for y in range(10, 40):
            for x in range(20, 42):
                first.putpixel((x, y), (255, 255, 255, 255))
        for y in range(12, 44):
            for x in range(48, 76):
                second.putpixel((x, y), (255, 255, 255, 255))

        rendered, bboxes, scale, canvas_size = server.resize_frames_on_source_canvas(
            [first, second],
            1.0,
        )

        self.assertEqual(scale, 1.0)
        self.assertEqual(canvas_size, (96, 54))
        self.assertEqual([frame.size for frame in rendered], [(96, 54), (96, 54)])
        self.assertEqual(bboxes, [(20, 10, 42, 40), (48, 12, 76, 44)])

    def test_source_canvas_resize_scales_whole_canvas_not_subject_bbox(self):
        frame = Image.new("RGBA", (100, 60), (0, 0, 0, 0))
        for y in range(20, 40):
            for x in range(70, 90):
                frame.putpixel((x, y), (255, 255, 255, 255))

        rendered, _bboxes, scale, canvas_size = server.resize_frames_on_source_canvas(
            [frame],
            0.5,
        )

        self.assertEqual(scale, 0.5)
        self.assertEqual(canvas_size, (50, 30))
        self.assertEqual(rendered[0].size, (50, 30))

    def test_magic_upscale_falls_back_when_realesrgan_drops_alpha(self):
        source = Image.new("RGBA", (20, 10), (0, 0, 0, 0))
        for y in range(2, 8):
            for x in range(3, 18):
                source.putpixel((x, y), (20, 220, 140, 255))

        original_runner = server.run_realesrgan_anime

        def fake_runner(input_path: Path, output_path: Path, output_scale=None) -> None:
            with Image.open(input_path) as image:
                Image.new("RGBA", (image.width * 4, image.height * 4), (0, 0, 0, 0)).save(output_path)

        server.run_realesrgan_anime = fake_runner
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                upscaled, source_size = server.build_magic_upscaled_frame(
                    source,
                    temp_path / "input.png",
                    temp_path / "output.png",
                )

                self.assertEqual(source_size, source.size)
                self.assertIsNotNone(upscaled.getchannel("A").getbbox())
                with Image.open(temp_path / "output.png") as saved_output:
                    self.assertIsNotNone(saved_output.convert("RGBA").getchannel("A").getbbox())
                upscaled.close()
        finally:
            server.run_realesrgan_anime = original_runner

    def test_magic_cache_skips_blank_frame_when_source_has_alpha(self):
        old_jobs_dir = server.JOBS_DIR
        old_magic_dir = server.MAGIC_DIR
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                server.JOBS_DIR = root / "jobs"
                server.MAGIC_DIR = root / "magic"

                job_id = "job-1"
                processed_dir = server.job_dir(job_id) / "processed"
                processed_dir.mkdir(parents=True)
                source = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
                for y in range(3, 9):
                    for x in range(3, 9):
                        source.putpixel((x, y), (255, 255, 255, 255))
                source.save(processed_dir / "frame_001.png")
                server.save_job_manifest(
                    job_id,
                    {
                        "frame_count": 1,
                        "frames": [{"index": 0, "name": "frame_001.png"}],
                    },
                )

                magic_root = server.MAGIC_DIR / "run-1-magic"
                variants = {}
                for config in server.MAGIC_VARIANTS:
                    frames_dir = magic_root / str(config["dir"])
                    frames_dir.mkdir(parents=True)
                    Image.new("RGBA", (6, 6), (0, 0, 0, 0)).save(frames_dir / "frame_001.png")
                    variants[str(config["key"])] = {
                        "key": str(config["key"]),
                        "frames_dir": str(frames_dir),
                        "frames": [
                            {
                                "index": 0,
                                "source_index": 0,
                                "name": "frame_001.png",
                                "width": 6,
                                "height": 6,
                            }
                        ],
                    }
                (magic_root / "manifest.json").write_text(
                    json.dumps(
                        {
                            "magic_id": "run-1",
                            "job_id": job_id,
                            "model": server.REAL_ESRGAN_ANIME_MODEL,
                            "resize_mode": "soft",
                            "variants": variants,
                        }
                    ),
                    encoding="utf-8",
                )

                self.assertEqual(server.find_cached_magic_frames(job_id, "soft"), {})
        finally:
            server.JOBS_DIR = old_jobs_dir
            server.MAGIC_DIR = old_magic_dir

    def test_magic_preview_can_skip_realesrgan(self):
        old_jobs_dir = server.JOBS_DIR
        old_magic_dir = server.MAGIC_DIR
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                server.JOBS_DIR = root / "jobs"
                server.MAGIC_DIR = root / "magic"

                job_id = "job-2"
                processed_dir = server.job_dir(job_id) / "processed"
                processed_dir.mkdir(parents=True)
                source = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
                for y in range(4, 12):
                    for x in range(5, 20):
                        source.putpixel((x, y), (40, 180, 255, 255))
                source.save(processed_dir / "frame_001.png")
                server.save_job_manifest(
                    job_id,
                    {
                        "frame_count": 1,
                        "frames": [
                            {
                                "index": 0,
                                "name": "frame_001.png",
                                "width": 24,
                                "height": 16,
                            }
                        ],
                    },
                )

                result = server.magic_preview_job(job_id, [0], "soft", use_realesrgan=False)

                self.assertFalse(result["use_realesrgan"])
                self.assertEqual(result["model"], "none")
                self.assertEqual(result["upscale"], 1)
                self.assertEqual(result["generated_count"], 1)
                self.assertEqual(result["reused_count"], 0)
                self.assertEqual(result["frame_count"], 1)
                for variant in result["variants"].values():
                    frame_path = Path(variant["frames_dir"]) / "frame_001.png"
                    with Image.open(frame_path) as image:
                        self.assertIsNotNone(image.convert("RGBA").getchannel("A").getbbox())
        finally:
            server.JOBS_DIR = old_jobs_dir
            server.MAGIC_DIR = old_magic_dir


if __name__ == "__main__":
    unittest.main()
