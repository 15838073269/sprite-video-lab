import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

import server


class AiMatteSizingTests(unittest.TestCase):
    def test_ai_model_install_requires_explicit_confirmation(self):
        with mock.patch.object(server, "require_ai_runtime_for_components") as require_runtime:
            with self.assertRaisesRegex(ValueError, "确认"):
                server.install_ai_models_for_matte_mode(False, "birefnet")

        require_runtime.assert_not_called()

    def test_ai_model_install_only_installs_components_for_selected_mode(self):
        completed_status = {"installed": True}
        with (
            mock.patch.object(server, "require_ai_runtime_for_components") as require_runtime,
            mock.patch.object(server, "download_birefnet_model") as download_birefnet,
            mock.patch.object(server, "download_corridorkey_checkpoint") as download_corridorkey,
            mock.patch.object(server, "ai_model_install_status", return_value=completed_status),
        ):
            result = server.install_ai_models_for_matte_mode(
                True,
                "birefnet_corridorkey",
                "birefnet-hr-matting",
            )

        require_runtime.assert_called_once_with(["birefnet", "corridorkey"])
        self.assertEqual(
            download_birefnet.call_args_list,
            [
                mock.call("birefnet-hr-matting"),
                mock.call("birefnet-general"),
            ],
        )
        self.assertEqual(
            download_corridorkey.call_args_list,
            [
                mock.call("green"),
                mock.call("blue"),
            ],
        )
        self.assertEqual(
            result["installed_models"],
            ["birefnet-hr-matting", "birefnet-general", "corridorkey-green", "corridorkey-blue"],
        )

    def test_non_ai_matte_mode_never_starts_installation(self):
        with mock.patch.object(server, "require_ai_runtime_for_components") as require_runtime:
            with self.assertRaisesRegex(ValueError, "不需要"):
                server.install_ai_models_for_matte_mode(True, "chroma")

        require_runtime.assert_not_called()

    def test_birefnet_processing_uses_cached_files_only(self):
        captured = {}

        class FakeModel:
            def to(self, _device):
                return self

            def eval(self):
                return self

        class FakeAutoModel:
            @staticmethod
            def from_pretrained(_repo_id, **kwargs):
                captured.update(kwargs)
                return FakeModel()

        fake_torch = mock.Mock()
        fake_torch.cuda.is_available.return_value = False
        with (
            mock.patch.object(server, "_BIREFNET_MODEL_CACHE", {}),
            mock.patch.object(
                server,
                "import_ai_matte_dependencies",
                return_value=(fake_torch, mock.Mock(), FakeAutoModel),
            ),
            mock.patch.object(server, "configure_ai_model_cache", return_value=Path("model-cache")),
        ):
            server.load_birefnet_model("birefnet-hr-matting", "cpu")

        self.assertTrue(captured["local_files_only"])

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

    def test_frames_export_only_copies_frames_and_writes_per_frame_durations(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            jobs_dir = root / "jobs"
            exports_dir = root / "exports"
            job_id = "export-frames"
            processed_dir = jobs_dir / job_id / "processed"
            processed_dir.mkdir(parents=True)
            exports_dir.mkdir()
            for index, color in enumerate(((255, 0, 0, 255), (0, 0, 255, 255)), start=1):
                Image.new("RGBA", (8, 6), color).save(processed_dir / f"source_{index:03d}.png")

            with (
                mock.patch.object(server, "JOBS_DIR", jobs_dir),
                mock.patch.object(server, "configured_exports_dir", return_value=exports_dir),
            ):
                server.save_job_manifest(
                    job_id,
                    {
                        "frames": [
                            {"index": 0, "name": "source_001.png"},
                            {"index": 1, "name": "source_002.png"},
                        ]
                    },
                )
                result = server.export_job(job_id, [1, 0], 75, "frames")

            output_dir = Path(result["output_dir"])
            frames_dir = Path(result["frames_dir"])
            metadata = json.loads((frames_dir / "frames.json").read_text(encoding="utf-8"))
            self.assertEqual(result["export_format"], "frames")
            self.assertEqual(metadata["frame_duration_ms"], 75)
            self.assertEqual(metadata["total_duration_ms"], 150)
            self.assertEqual(
                metadata["frames"],
                [
                    {"index": 0, "source_index": 1, "file": "frame_001.png", "duration_ms": 75},
                    {"index": 1, "source_index": 0, "file": "frame_002.png", "duration_ms": 75},
                ],
            )
            self.assertEqual(sorted(path.name for path in frames_dir.iterdir()), ["frame_001.png", "frame_002.png", "frames.json"])
            self.assertFalse((output_dir / "sprite-sheet").exists())
            self.assertEqual(list(output_dir.glob("*.mov")), [])
            self.assertEqual(list(output_dir.glob("*.gif")), [])

    def test_each_non_frame_export_only_runs_its_selected_generator(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            jobs_dir = root / "jobs"
            exports_dir = root / "exports"
            job_id = "export-formats"
            processed_dir = jobs_dir / job_id / "processed"
            processed_dir.mkdir(parents=True)
            exports_dir.mkdir()
            Image.new("RGBA", (8, 6), (255, 255, 255, 255)).save(processed_dir / "source.png")

            def fake_mov(_paths, _sizes, output_path, _width, _height, _duration):
                output_path.write_bytes(b"mov")

            def fake_gif(_paths, _sizes, output_path, _width, _height, _duration):
                output_path.write_bytes(b"gif")

            def fake_sheet(_paths, _sizes, sheet_path, metadata_path, width, height, duration):
                sheet_path.write_bytes(b"sheet")
                metadata_path.write_text("{}", encoding="utf-8")
                return {"columns": 1, "rows": 1, "width": width, "height": height, "duration_ms": duration}

            with (
                mock.patch.object(server, "JOBS_DIR", jobs_dir),
                mock.patch.object(server, "configured_exports_dir", return_value=exports_dir),
                mock.patch.object(server, "save_alpha_mov", side_effect=fake_mov) as mov_mock,
                mock.patch.object(server, "save_gif", side_effect=fake_gif) as gif_mock,
                mock.patch.object(server, "save_sprite_sheet", side_effect=fake_sheet) as sheet_mock,
            ):
                server.save_job_manifest(job_id, {"frames": [{"index": 0, "name": "source.png"}]})
                mov_result = server.export_job(job_id, [0], 100, "mov")
                gif_result = server.export_job(job_id, [0], 100, "gif")
                sheet_result = server.export_job(job_id, [0], 100, "sprite_sheet")

            self.assertEqual((mov_mock.call_count, gif_mock.call_count, sheet_mock.call_count), (1, 1, 1))
            self.assertEqual(set(path.suffix for path in Path(mov_result["output_dir"]).iterdir()), {".mov"})
            self.assertEqual(set(path.suffix for path in Path(gif_result["output_dir"]).iterdir()), {".gif"})
            self.assertEqual(
                sorted(path.name for path in Path(sheet_result["sheet_dir"]).iterdir()),
                ["sheet.json", "sheet.png"],
            )
            for result in (mov_result, gif_result, sheet_result):
                self.assertFalse((Path(result["output_dir"]) / "frames").exists())

    def test_export_rejects_unknown_format_before_creating_output(self):
        with self.assertRaisesRegex(ValueError, "unsupported export format"):
            server.normalize_export_format("everything")

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
