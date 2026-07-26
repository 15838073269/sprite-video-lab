const state = {
  upload: null,
  job: null,
  exportResult: null,
  processPreview: null,
  selected: new Set(),
  orderedSelectionMode: false,
  selectionOrder: [],
  segment: { start: 0, end: 0, startFrame: 1, endFrame: 1, confirmed: false },
  segmentPlaybackRafId: null,
  preview: {
    rafId: null,
    currentIndex: 0,
    isPlaying: true,
    isReversed: false,
    renderToken: 0,
    warmupToken: 0,
    imageCache: new Map(),
    background: "#F6FBF6",
  },
  magicPreview: null,
  magicInFlight: false,
  magicResizeMode: "hard",
  magicUseRealesrgan: true,
  processPreviewZoom: {
    source: 100,
    processed: 100,
  },
  processPreviewBackground: {
    mode: "checkerboard",
    color: "#F6FBF6",
  },
  processPreviewPan: {
    source: { x: 0, y: 0 },
    processed: { x: 0, y: 0 },
  },
  processPreviewDrag: null,
};

const els = {};
const STORAGE_KEY = "sprite-video-lab-session-v2";
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".mkv", ".webm", ".gif"];
const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const SUPPORTED_UPLOAD_EXTENSIONS = [...SUPPORTED_VIDEO_EXTENSIONS, ...SUPPORTED_IMAGE_EXTENSIONS];
const AI_RESOLUTION_MIN = 256;
const AI_RESOLUTION_MAX = 2560;
const AI_RESOLUTION_STEP = 32;
const AI_RESOLUTION_DEFAULT = 1024;
const AI_RESOLUTION_AUTO = "auto";
const AI_MODEL_AUTO = "birefnet-hr-matting";
const AI_DEVICE_AUTO = "auto";
const OUTPUT_SCALE_MIN_PERCENT = 5;
const OUTPUT_SCALE_MAX_PERCENT = 200;
const OUTPUT_SCALE_DEFAULT_PERCENT = 100;
const MAGIC_VARIANT_CONFIGS = [
  {
    key: "half",
    label: "MAGIC 1/2",
    panelId: "magicPreviewPanel",
    canvasId: "magicPreviewCanvas",
    emptyId: "magicPreviewEmptyState",
    frameLabelId: "magicPreviewFrameLabel",
    countId: "magicPreviewSelectedCount",
    progressFillId: "magicPreviewProgressFill",
    progressLabelId: "magicPreviewProgressLabel",
    sizeLabelId: "magicOutputSizeLabel",
    exportButtonId: "exportMagicFramesButton",
  },
  {
    key: "quarter",
    label: "MAGIC 1/4",
    panelId: "magicQuarterPreviewPanel",
    canvasId: "magicQuarterPreviewCanvas",
    emptyId: "magicQuarterPreviewEmptyState",
    frameLabelId: "magicQuarterPreviewFrameLabel",
    countId: "magicQuarterPreviewSelectedCount",
    progressFillId: "magicQuarterPreviewProgressFill",
    progressLabelId: "magicQuarterPreviewProgressLabel",
    sizeLabelId: "magicQuarterOutputSizeLabel",
    exportButtonId: "exportMagicQuarterFramesButton",
  },
  {
    key: "eighth",
    label: "MAGIC 1/8",
    panelId: "magicEighthPreviewPanel",
    canvasId: "magicEighthPreviewCanvas",
    emptyId: "magicEighthPreviewEmptyState",
    frameLabelId: "magicEighthPreviewFrameLabel",
    countId: "magicEighthPreviewSelectedCount",
    progressFillId: "magicEighthPreviewProgressFill",
    progressLabelId: "magicEighthPreviewProgressLabel",
    sizeLabelId: "magicEighthOutputSizeLabel",
    exportButtonId: "exportMagicEighthFramesButton",
  },
];
const MAGIC_RESIZE_MODE_LABELS = {
  hard: "硬",
  soft: "软",
};
let hotReloadVersion = null;
let hotReloadTimerId = null;
let uploadDragDepth = 0;
let skipSessionPersistence = false;

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  updatePreviewBackground(state.preview.background, false);
  updateProcessPreviewBackground(state.processPreviewBackground.mode, state.processPreviewBackground.color, false);
  syncManualColorLabel();
  updateChromaVisibility();
  normalizePreviewInterval();
  updatePreviewControls(0);
  drawPreviewPlaceholder();
  resetProcessPreview();
  updateSegmentConfirmationUI();
  showAnimationWorkbench();
  setStatus("\u7B49\u5F85\u5BFC\u5165\u7D20\u6750\u3002");
  void loadOutputPath();
  restoreSessionFromStorage();
  enforceAutomaticAiSettings(false);
  startHotReloadPolling();
  window.addEventListener("beforeunload", persistSession);
});

function bindElements() {
  [
    "pathInput",
    "importPathButton",
    "outputPathInput",
    "saveOutputPathButton",
    "clearRuntimeFilesButton",
    "uploadDropzone",
    "uploadInput",
    "videoName",
    "videoSize",
    "videoFps",
    "videoDuration",
    "previewPanel",
    "processPanel",
    "resultPanel",
    "videoPreview",
    "mediaPreviewImage",
    "videoProgress",
    "videoProgressFill",
    "videoProgressLabel",
    "videoToolbar",
    "currentTimeLabel",
    "startRange",
    "startInput",
    "startStepUpButton",
    "startStepDownButton",
    "endRange",
    "endInput",
    "endStepUpButton",
    "endStepDownButton",
    "segmentLength",
    "segmentConfirmStatus",
    "segmentConfirmHint",
    "keepEveryInput",
    "outputScaleInput",
    "canvasModeInput",
    "reducePxInput",
    "chromaEnabledInput",
    "matteModeInput",
    "keyModeInput",
    "manualColorField",
    "manualKeyInput",
    "manualKeyLabel",
    "thresholdInput",
    "softnessInput",
    "despillInput",
    "haloInput",
    "corridorEnabledInput",
    "corridorScreenInput",
    "aiModelInput",
    "aiDeviceInput",
    "aiResolutionInput",
    "lumaBlackInput",
    "lumaWhiteInput",
    "lumaGammaInput",
    "lumaStrengthInput",
    "lumaPolarityInput",
    "batchGreenToBlackInput",
    "batchGreenDesaturateInput",
    "batchSemiTransparentToBlackInput",
    "batchSemiTransparentToOpaqueInput",
    "previewFrameButton",
    "greenToBlackButton",
    "greenDesaturateButton",
    "semiTransparentToBlackButton",
    "semiTransparentToOpaqueButton",
    "savePreviewButton",
    "processPreviewTimeLabel",
    "processPreviewKeyLabel",
    "previewSourceImage",
    "previewSourceEmpty",
    "previewSourceZoomInput",
    "previewSourceZoomLabel",
    "previewSourceZoomOutButton",
    "previewSourceZoomResetButton",
    "previewSourcePanResetButton",
    "previewSourceZoomInButton",
    "previewProcessedImage",
    "previewProcessedEmpty",
    "previewProcessedStage",
    "processPreviewBackgroundModeInput",
    "processPreviewBackgroundInput",
    "processPreviewBackgroundLabel",
    "processPreviewBackgroundColorRow",
    "previewProcessedZoomInput",
    "previewProcessedZoomLabel",
    "previewProcessedZoomOutButton",
    "previewProcessedZoomResetButton",
    "previewProcessedPanResetButton",
    "previewProcessedZoomInButton",
    "processStepShell",
    "processLockNote",
    "processButton",
    "jobSummary",
    "selectionCount",
    "customAnimationInput",
    "customAnimationFolderInput",
    "clearPreviewFramesButton",
    "importAnimationButton",
    "importAnimationFolderButton",
    "openProcessedButton",
    "animationPreviewCanvas",
    "previewEmptyState",
    "previewFrameLabel",
    "previewSelectedCount",
    "previewProgressBar",
    "previewProgressFill",
    "previewProgressLabel",
    "previewPlayPauseButton",
    "previewRestartButton",
    "previewReverseInput",
    "previewBackgroundInput",
    "previewBackgroundLabel",
    "previewIntervalInput",
    "magicPreviewPanel",
    "magicPreviewCanvas",
    "magicPreviewEmptyState",
    "magicPreviewFrameLabel",
    "magicPreviewSelectedCount",
    "magicPreviewProgressBar",
    "magicPreviewProgressFill",
    "magicPreviewProgressLabel",
    "magicOutputSizeLabel",
    "exportMagicFramesButton",
    "magicQuarterPreviewPanel",
    "magicQuarterPreviewCanvas",
    "magicQuarterPreviewEmptyState",
    "magicQuarterPreviewFrameLabel",
    "magicQuarterPreviewSelectedCount",
    "magicQuarterPreviewProgressBar",
    "magicQuarterPreviewProgressFill",
    "magicQuarterPreviewProgressLabel",
    "magicQuarterOutputSizeLabel",
    "exportMagicQuarterFramesButton",
    "magicEighthPreviewPanel",
    "magicEighthPreviewCanvas",
    "magicEighthPreviewEmptyState",
    "magicEighthPreviewFrameLabel",
    "magicEighthPreviewSelectedCount",
    "magicEighthPreviewProgressBar",
    "magicEighthPreviewProgressFill",
    "magicEighthPreviewProgressLabel",
    "magicEighthOutputSizeLabel",
    "exportMagicEighthFramesButton",
    "frameGrid",
    "selectAllButton",
    "selectNoneButton",
    "selectOddButton",
    "selectEvenButton",
    "invertSelectionButton",
    "orderedSelectionInput",
    "exportButton",
    "exportOptions",
    "exportFramesButton",
    "exportSpriteSheetButton",
    "exportMovButton",
    "exportGifButton",
    "magicUseRealesrganInput",
    "magicResizeHardInput",
    "magicResizeSoftInput",
    "magicButton",
    "exportResult",
    "appStatus",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function normalizeMagicResizeMode(mode) {
  return mode === "soft" ? "soft" : "hard";
}

function magicResizeModeLabel(mode = state.magicResizeMode) {
  return MAGIC_RESIZE_MODE_LABELS[normalizeMagicResizeMode(mode)];
}

function setMagicResizeMode(mode, { clearExisting = true } = {}) {
  const normalized = normalizeMagicResizeMode(mode);
  const changed = state.magicResizeMode !== normalized;
  state.magicResizeMode = normalized;
  if (els.magicResizeHardInput) {
    els.magicResizeHardInput.checked = normalized === "hard";
  }
  if (els.magicResizeSoftInput) {
    els.magicResizeSoftInput.checked = normalized === "soft";
  }
  if (changed && clearExisting) {
    clearMagicPreview();
  }
}

function setMagicUseRealesrgan(enabled, { clearExisting = true } = {}) {
  const next = Boolean(enabled);
  const changed = state.magicUseRealesrgan !== next;
  state.magicUseRealesrgan = next;
  if (els.magicUseRealesrganInput) {
    els.magicUseRealesrganInput.checked = next;
  }
  if (changed && clearExisting) {
    clearMagicPreview();
  }
}

function bindEvents() {
  els.importPathButton.addEventListener("click", importFromPath);
  els.saveOutputPathButton.addEventListener("click", selectOutputPath);
  els.clearRuntimeFilesButton.addEventListener("click", clearRuntimeFiles);
  els.uploadInput.addEventListener("change", handleUploadInputChange);
  els.previewFrameButton.addEventListener("click", previewCurrentFrame);
  els.greenToBlackButton.addEventListener("click", applyGreenToBlackPreview);
  els.greenDesaturateButton.addEventListener("click", applyGreenDesaturatePreview);
  els.semiTransparentToBlackButton.addEventListener("click", applySemiTransparentToBlackPreview);
  els.semiTransparentToOpaqueButton.addEventListener("click", applySemiTransparentToOpaquePreview);
  els.savePreviewButton.addEventListener("click", downloadProcessPreviewResult);
  els.processButton.addEventListener("click", processVideo);
  els.exportButton.addEventListener("click", toggleExportOptions);
  els.exportFramesButton.addEventListener("click", () => exportSelectedFormat("frames", els.exportFramesButton));
  els.exportSpriteSheetButton.addEventListener("click", () => exportSelectedFormat("sprite_sheet", els.exportSpriteSheetButton));
  els.exportMovButton.addEventListener("click", () => exportSelectedFormat("mov", els.exportMovButton));
  els.exportGifButton.addEventListener("click", () => exportSelectedFormat("gif", els.exportGifButton));
  els.magicButton.addEventListener("click", runMagicPreview);
  els.magicUseRealesrganInput.addEventListener("change", () => {
    setMagicUseRealesrgan(els.magicUseRealesrganInput.checked);
  });
  els.magicResizeHardInput.addEventListener("change", () => {
    setMagicResizeMode(els.magicResizeHardInput.checked ? "hard" : "soft");
  });
  els.magicResizeSoftInput.addEventListener("change", () => {
    setMagicResizeMode(els.magicResizeSoftInput.checked ? "soft" : "hard");
  });
  setMagicUseRealesrgan(state.magicUseRealesrgan, { clearExisting: false });
  setMagicResizeMode(state.magicResizeMode, { clearExisting: false });
  els.exportMagicFramesButton.addEventListener("click", () => exportMagicFrames("half", els.exportMagicFramesButton));
  els.exportMagicQuarterFramesButton.addEventListener("click", () => exportMagicFrames("quarter", els.exportMagicQuarterFramesButton));
  els.exportMagicEighthFramesButton.addEventListener("click", () => exportMagicFrames("eighth", els.exportMagicEighthFramesButton));
  bindUploadDropzone();

  bindTimePair("start", els.startRange, els.startInput, els.startStepDownButton, els.startStepUpButton);
  bindTimePair("end", els.endRange, els.endInput, els.endStepDownButton, els.endStepUpButton);

  els.videoPreview.addEventListener("loadedmetadata", () => {
    if (!isVideoUpload()) {
      return;
    }
    muteVideoPreview();
    updateVideoProgress(state.segment.start || 0);
    restartSegmentPlayback({ autoplay: false });
  });

  els.videoPreview.addEventListener("timeupdate", () => {
    if (!isVideoUpload()) {
      return;
    }
    const current = els.videoPreview.currentTime || 0;
    els.currentTimeLabel.textContent = `\u5f53\u524d ${formatSeconds(current)}`;
    updateVideoProgress(current);
  });
  els.videoPreview.addEventListener("play", startSegmentPlaybackMonitor);
  els.videoPreview.addEventListener("pause", stopSegmentPlaybackMonitor);
  els.videoPreview.addEventListener("ended", () => restartSegmentPlayback({ autoplay: true }));

  els.manualKeyInput.addEventListener("input", syncManualColorLabel);
  els.matteModeInput.addEventListener("change", updateChromaVisibility);
  els.keyModeInput.addEventListener("change", updateChromaVisibility);
  els.chromaEnabledInput.addEventListener("change", updateChromaVisibility);
  els.corridorEnabledInput.addEventListener("change", updateChromaVisibility);
  els.aiResolutionInput.addEventListener("change", normalizeAiResolutionInput);

  els.frameGrid.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    setFrameSelected(index, target.checked);
    clearMagicPreview();
    if (state.orderedSelectionMode) {
      renderFrames();
    } else {
      refreshCardSelection(index, target.checked);
      renderSelectionCount();
      syncAnimationPreview();
      syncResultActions();
      persistSession();
    }
  });

  els.selectAllButton.addEventListener("click", () => selectFrames(() => true));
  els.selectNoneButton.addEventListener("click", () => {
    state.selected = new Set();
    state.selectionOrder = [];
    state.preview.currentIndex = 0;
    clearMagicPreview();
    renderFrames();
  });
  els.selectOddButton.addEventListener("click", () => selectFrames((frame) => (frame.index + 1) % 2 === 1));
  els.selectEvenButton.addEventListener("click", () => selectFrames((frame) => (frame.index + 1) % 2 === 0));
  els.invertSelectionButton.addEventListener("click", () => {
    if (!state.job) return;
    const next = new Set();
    state.job.frames.forEach((frame) => {
      if (!state.selected.has(frame.index)) {
        next.add(frame.index);
      }
    });
    state.selected = next;
    state.selectionOrder = state.job.frames.filter((frame) => next.has(frame.index)).map((frame) => frame.index);
    state.preview.currentIndex = 0;
    clearMagicPreview();
    renderFrames();
  });
  els.orderedSelectionInput.addEventListener("change", () => {
    setOrderedSelectionMode(els.orderedSelectionInput.checked);
    normalizeSelectionOrder();
    state.preview.currentIndex = 0;
    clearMagicPreview();
    renderFrames();
  });
  els.clearPreviewFramesButton.addEventListener("click", clearPreviewFrames);
  els.importAnimationButton.addEventListener("click", () => els.customAnimationInput.click());
  els.importAnimationFolderButton.addEventListener("click", () => els.customAnimationFolderInput.click());
  els.customAnimationInput.addEventListener("change", async () => {
    await importCustomAnimationFrames(Array.from(els.customAnimationInput.files || []), els.importAnimationButton);
    els.customAnimationInput.value = "";
  });
  els.customAnimationFolderInput.addEventListener("change", async () => {
    await importCustomAnimationFrames(Array.from(els.customAnimationFolderInput.files || []), els.importAnimationFolderButton);
    els.customAnimationFolderInput.value = "";
  });

  els.openProcessedButton.addEventListener("click", async () => {
    if (state.job?.processed_dir) {
      await openPath(state.job.processed_dir);
    }
  });

  els.previewPlayPauseButton.addEventListener("click", togglePreviewPlayback);
  els.previewRestartButton.addEventListener("click", restartPreviewPlayback);
  els.previewReverseInput.addEventListener("change", () => {
    state.preview.isReversed = els.previewReverseInput.checked;
    state.preview.currentIndex = 0;
    clearMagicPreview();
    syncAnimationPreview();
    persistSession();
  });
  els.previewBackgroundInput.addEventListener("input", () => {
    updatePreviewBackground(els.previewBackgroundInput.value, true);
    syncAnimationPreview(false);
  });
  els.processPreviewBackgroundModeInput.addEventListener("change", () => {
    updateProcessPreviewBackground(
      els.processPreviewBackgroundModeInput.value,
      state.processPreviewBackground.color,
      true
    );
  });
  els.processPreviewBackgroundInput.addEventListener("input", () => {
    updateProcessPreviewBackground("color", els.processPreviewBackgroundInput.value, true);
  });
  els.previewIntervalInput.addEventListener("change", () => {
    normalizePreviewInterval();
    restartPreviewTimer();
    persistSession();
  });
  bindProcessPreviewZoom("source");
  bindProcessPreviewZoom("processed");
  bindProcessPreviewPan("source");
  bindProcessPreviewPan("processed");
  window.addEventListener("resize", () => {
    applyProcessPreviewTransform("source");
    applyProcessPreviewTransform("processed");
  });

  [
    els.keepEveryInput,
    els.outputScaleInput,
    els.canvasModeInput,
    els.reducePxInput,
    els.chromaEnabledInput,
    els.keyModeInput,
    els.manualKeyInput,
    els.thresholdInput,
    els.softnessInput,
    els.despillInput,
    els.haloInput,
    els.corridorEnabledInput,
    els.corridorScreenInput,
    els.matteModeInput,
    els.aiModelInput,
    els.aiDeviceInput,
    els.aiResolutionInput,
    els.lumaBlackInput,
    els.lumaWhiteInput,
    els.lumaGammaInput,
    els.lumaStrengthInput,
    els.lumaPolarityInput,
    els.batchGreenToBlackInput,
    els.batchGreenDesaturateInput,
    els.batchSemiTransparentToBlackInput,
    els.batchSemiTransparentToOpaqueInput,
    els.startInput,
    els.endInput,
  ].forEach((element) => {
    const eventName = element instanceof HTMLInputElement && element.type === "checkbox" ? "change" : "input";
    element.addEventListener(eventName, persistSession);
  });
}

function bindTimePair(key, rangeEl, numberEl, decreaseButton, increaseButton) {
  const frameKey = key === "start" ? "startFrame" : "endFrame";
  const applySegmentFrame = (nextFrame) => {
    state.segment[frameKey] = clampSegmentFrame(nextFrame);
    normalizeSegment(key);
    renderSegmentControls();
    updateSegmentConfirmationUI();
    restartSegmentPlayback({ autoplay: true });
    persistSession();
  };

  const handler = (event) => {
    const nextValue = Number(event.target.value);
    if (Number.isNaN(nextValue)) {
      return;
    }
    applySegmentFrame(nextValue);
  };

  rangeEl.addEventListener("input", handler);
  numberEl.addEventListener("input", handler);
  numberEl.addEventListener("change", handler);
  decreaseButton.addEventListener("click", () => {
    applySegmentFrame(state.segment[frameKey] - 1);
  });
  increaseButton.addEventListener("click", () => {
    applySegmentFrame(state.segment[frameKey] + 1);
  });
  numberEl.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? 1 : -1;
    applySegmentFrame(state.segment[frameKey] + direction);
  });
}

function bindProcessPreviewZoom(kind) {
  const { input, decreaseButton, zoomResetButton, panResetButton, increaseButton } = getProcessPreviewElements(kind);

  input.addEventListener("input", () => {
    updateProcessPreviewZoom(kind, Number(input.value || 100), true);
  });
  decreaseButton.addEventListener("click", () => {
    updateProcessPreviewZoom(kind, state.processPreviewZoom[kind] - 10, true);
  });
  zoomResetButton.addEventListener("click", () => {
    resetProcessPreviewZoom(kind, true);
  });
  panResetButton.addEventListener("click", () => {
    resetProcessPreviewPan(kind, true);
  });
  increaseButton.addEventListener("click", () => {
    updateProcessPreviewZoom(kind, state.processPreviewZoom[kind] + 10, true);
  });
}

function bindProcessPreviewPan(kind) {
  const { image, stage } = getProcessPreviewElements(kind);
  if (!stage) {
    return;
  }

  image.addEventListener("load", () => {
    applyProcessPreviewTransform(kind);
  });

  stage.addEventListener("pointerdown", (event) => {
    if (image.hidden || !image.getAttribute("src")) {
      return;
    }
    if (event.button != null && event.button !== 0) {
      return;
    }

    const pan = state.processPreviewPan[kind] || { x: 0, y: 0 };
    state.processPreviewDrag = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    stage.classList.add("dragging");
    if (typeof stage.setPointerCapture === "function") {
      stage.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  });

  stage.addEventListener("pointermove", (event) => {
    const drag = state.processPreviewDrag;
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) {
      return;
    }

    updateProcessPreviewPan(
      kind,
      drag.startPanX + event.clientX - drag.startX,
      drag.startPanY + event.clientY - drag.startY
    );
    event.preventDefault();
  });

  const endDrag = (event) => {
    const drag = state.processPreviewDrag;
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) {
      return;
    }

    state.processPreviewDrag = null;
    stage.classList.remove("dragging");
    if (typeof stage.hasPointerCapture === "function" && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
  };

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("lostpointercapture", endDrag);
  stage.addEventListener("dblclick", () => {
    updateProcessPreviewPan(kind, 0, 0);
  });
}

function getProcessPreviewElements(kind) {
  const isSource = kind === "source";
  const image = isSource ? els.previewSourceImage : els.previewProcessedImage;
  return {
    input: isSource ? els.previewSourceZoomInput : els.previewProcessedZoomInput,
    label: isSource ? els.previewSourceZoomLabel : els.previewProcessedZoomLabel,
    image,
    stage: image?.closest(".image-preview-stage") || null,
    decreaseButton: isSource ? els.previewSourceZoomOutButton : els.previewProcessedZoomOutButton,
    zoomResetButton: isSource ? els.previewSourceZoomResetButton : els.previewProcessedZoomResetButton,
    panResetButton: isSource ? els.previewSourcePanResetButton : els.previewProcessedPanResetButton,
    increaseButton: isSource ? els.previewSourceZoomInButton : els.previewProcessedZoomInButton,
  };
}

function updateProcessPreviewZoom(kind, value, shouldPersist = false) {
  const normalized = clamp(Math.round(value / 10) * 10, 50, 800);
  state.processPreviewZoom[kind] = normalized;

  const { input, label } = getProcessPreviewElements(kind);

  input.value = String(normalized);
  label.textContent = `${normalized}%`;
  applyProcessPreviewTransform(kind);

  if (shouldPersist) {
    persistSession();
  }
}

function updateProcessPreviewPan(kind, x, y) {
  state.processPreviewPan[kind] = normalizeProcessPreviewPan(x, y);
  applyProcessPreviewTransform(kind);
}

function normalizeProcessPreviewPan(x, y) {
  const panX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const panY = Number.isFinite(Number(y)) ? Number(y) : 0;
  return { x: panX, y: panY };
}

function applyProcessPreviewTransform(kind) {
  const { image } = getProcessPreviewElements(kind);
  if (!image) {
    return;
  }
  const pan = state.processPreviewPan[kind] || { x: 0, y: 0 };
  const scale = state.processPreviewZoom[kind] / 100;
  image.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`;
}

function resetProcessPreviewPan(kind, shouldPersist = false) {
  state.processPreviewPan[kind] = { x: 0, y: 0 };
  applyProcessPreviewTransform(kind);
  if (shouldPersist) {
    persistSession();
  }
}

function resetProcessPreviewZoom(kind, shouldPersist = false) {
  updateProcessPreviewZoom(kind, 100, false);
  if (shouldPersist) {
    persistSession();
  }
}

function resetProcessPreviewView(kind, shouldPersist = false) {
  resetProcessPreviewZoom(kind, false);
  resetProcessPreviewPan(kind, false);
  if (shouldPersist) {
    persistSession();
  }
}

function setProcessPreviewStageActive(kind, isActive) {
  const { stage } = getProcessPreviewElements(kind);
  if (!stage) {
    return;
  }
  stage.classList.toggle("is-pannable", isActive);
  if (!isActive) {
    stage.classList.remove("dragging");
  }
}

function currentMatteMode() {
  if (!els.chromaEnabledInput.checked) {
    return "none";
  }
  return els.matteModeInput.value || "chroma";
}

function matteModeUsesBiRefNet(mode) {
  return (
    mode === "birefnet" ||
    mode === "birefnet_corridorkey" ||
    mode === "birefnet_corridorkey_key" ||
    mode === "birefnet_luma" ||
    mode === "birefnet_luma_key" ||
    mode === "birefnet_luma_corridorkey"
  );
}

function matteModeUsesCorridorKey(mode) {
  return (
    mode === "corridorkey" ||
    mode === "birefnet_corridorkey" ||
    mode === "birefnet_corridorkey_key" ||
    mode === "birefnet_luma_corridorkey"
  );
}

function matteModeUsesLuma(mode) {
  return mode === "luma" || mode === "birefnet_luma" || mode === "birefnet_luma_key" || mode === "birefnet_luma_corridorkey";
}

function matteModeUsesChromaSeed(mode) {
  return mode === "chroma" || mode === "corridorkey";
}

function currentUsesCorridorKey() {
  return matteModeUsesCorridorKey(currentMatteMode());
}

function normalizeAiResolution(value) {
  const rawText = String(value ?? "").trim().toLowerCase();
  if (!rawText || rawText === AI_RESOLUTION_AUTO) {
    return AI_RESOLUTION_AUTO;
  }
  const numeric = Number(value);
  const raw = Number.isFinite(numeric) ? numeric : AI_RESOLUTION_DEFAULT;
  const clamped = clamp(Math.round(raw), AI_RESOLUTION_MIN, AI_RESOLUTION_MAX);
  const aligned = Math.floor((clamped + AI_RESOLUTION_STEP / 2) / AI_RESOLUTION_STEP) * AI_RESOLUTION_STEP;
  return clamp(aligned, AI_RESOLUTION_MIN, AI_RESOLUTION_MAX);
}

function ensureAiResolutionOption(value) {
  const normalizedValue = String(value);
  if ([...els.aiResolutionInput.options].some((option) => option.value === normalizedValue)) {
    return;
  }
  const option = document.createElement("option");
  option.value = normalizedValue;
  option.textContent = `${normalizedValue} px`;
  els.aiResolutionInput.appendChild(option);
}

function setAiResolutionValue(value) {
  const normalized = normalizeAiResolution(value);
  ensureAiResolutionOption(normalized);
  els.aiResolutionInput.value = String(normalized);
}

function normalizeAiResolutionInput(shouldPersist = true) {
  const normalized = normalizeAiResolution(els.aiResolutionInput.value);
  setAiResolutionValue(normalized);
  if (shouldPersist) {
    persistSession();
  }
}

function enforceAutomaticAiSettings(shouldPersist = false) {
  els.aiModelInput.value = AI_MODEL_AUTO;
  els.aiDeviceInput.value = AI_DEVICE_AUTO;
  setAiResolutionValue(AI_RESOLUTION_AUTO);
  if (shouldPersist) {
    persistSession();
  }
}

function normalizeOutputScalePercent(value) {
  const numeric = Number(value);
  const raw = Number.isFinite(numeric) ? numeric : OUTPUT_SCALE_DEFAULT_PERCENT;
  return clamp(Math.round(raw), OUTPUT_SCALE_MIN_PERCENT, OUTPUT_SCALE_MAX_PERCENT);
}

function currentOutputScale() {
  return normalizeOutputScalePercent(els.outputScaleInput.value) / 100;
}

function effectiveCanvasModeForProcessing() {
  return isVideoUpload() ? "auto" : els.canvasModeInput.value;
}

function effectiveReducePxForProcessing() {
  return isVideoUpload() ? 0 : Number(els.reducePxInput.value || 0);
}

function outputScalePercentFromLegacyTarget(targetSize) {
  const height = Number(currentUploadInfo().height || 0);
  const target = Number(targetSize || 0);
  if (!height || !target) {
    return null;
  }
  return normalizeOutputScalePercent((target / height) * 100);
}

function applyAutomaticMatteDefaults() {
  els.thresholdInput.value = "80";
  els.softnessInput.value = "16";
  els.despillInput.value = "0.6";
  els.haloInput.value = "1";
  els.lumaBlackInput.value = "0";
  els.lumaWhiteInput.value = "85";
  els.lumaGammaInput.value = "0.55";
  els.lumaStrengthInput.value = "1.7";
}

function collectFormState() {
  return {
    keep_every: Number(els.keepEveryInput.value || 1),
    output_scale: currentOutputScale(),
    canvas_mode: els.canvasModeInput.value,
    reduce_px: Number(els.reducePxInput.value || 0),
    chroma_enabled: els.chromaEnabledInput.checked,
    matte_mode: currentMatteMode(),
    key_mode: els.keyModeInput.value,
    manual_key_hex: els.manualKeyInput.value,
    threshold: Number(els.thresholdInput.value || 0),
    softness: Number(els.softnessInput.value === "" ? 1 : els.softnessInput.value),
    despill_strength: Number(els.despillInput.value || 0),
    halo_pixels: Number(els.haloInput.value || 0),
    corridorkey_enabled: currentUsesCorridorKey(),
    corridorkey_screen: els.corridorScreenInput.value,
    ai_model: els.aiModelInput.value,
    ai_device: els.aiDeviceInput.value,
    ai_resolution: normalizeAiResolution(els.aiResolutionInput.value),
    ai_resolution_mode: normalizeAiResolution(els.aiResolutionInput.value) === AI_RESOLUTION_AUTO ? "auto" : "manual",
    luma_black: Number(els.lumaBlackInput.value || 0),
    luma_white: Number(els.lumaWhiteInput.value || 85),
    luma_gamma: Number(els.lumaGammaInput.value || 0.55),
    luma_strength: Number(els.lumaStrengthInput.value || 1.7),
    luma_polarity: els.lumaPolarityInput.value || "auto",
    batch_green_to_black: els.batchGreenToBlackInput.checked,
    batch_green_desaturate: els.batchGreenDesaturateInput.checked,
    batch_semitransparent_to_black: els.batchSemiTransparentToBlackInput.checked,
    batch_semitransparent_to_opaque: els.batchSemiTransparentToOpaqueInput.checked,
    preview_background: state.preview.background,
    preview_interval: clamp(Number(els.previewIntervalInput.value || 100), 20, 5000),
    preview_reversed: state.preview.isReversed,
    process_preview_zoom: {
      source: state.processPreviewZoom.source,
      processed: state.processPreviewZoom.processed,
    },
    process_preview_background: {
      mode: state.processPreviewBackground.mode,
      color: state.processPreviewBackground.color,
    },
    magic_resize_mode: state.magicResizeMode,
    magic_use_realesrgan: state.magicUseRealesrgan,
    segment: {
      start: Number(state.segment.start || 0),
      end: Number(state.segment.end || 0),
      startFrame: Number(state.segment.startFrame || 1),
      endFrame: Number(state.segment.endFrame || 1),
      confirmed: Boolean(state.segment.confirmed),
    },
  };
}

function collectProcessingPayload() {
  return {
    upload_id: state.upload?.upload_id || "",
    start_time: state.segment.start,
    end_time: state.segment.end,
    start_frame: state.segment.startFrame,
    end_frame: state.segment.endFrame,
    keep_every: Number(els.keepEveryInput.value || 1),
    output_scale: currentOutputScale(),
    canvas_mode: effectiveCanvasModeForProcessing(),
    reduce_px: effectiveReducePxForProcessing(),
    chroma_enabled: els.chromaEnabledInput.checked,
    matte_mode: currentMatteMode(),
    key_mode: els.keyModeInput.value,
    manual_key_hex: els.manualKeyInput.value,
    threshold: Number(els.thresholdInput.value || 0),
    softness: Number(els.softnessInput.value === "" ? 1 : els.softnessInput.value),
    despill_strength: Number(els.despillInput.value || 0),
    halo_pixels: Number(els.haloInput.value || 0),
    corridorkey_enabled: currentUsesCorridorKey(),
    corridorkey_screen: els.corridorScreenInput.value,
    ai_model: els.aiModelInput.value,
    ai_device: els.aiDeviceInput.value,
    ai_resolution: normalizeAiResolution(els.aiResolutionInput.value),
    luma_black: Number(els.lumaBlackInput.value || 0),
    luma_white: Number(els.lumaWhiteInput.value || 85),
    luma_gamma: Number(els.lumaGammaInput.value || 0.55),
    luma_strength: Number(els.lumaStrengthInput.value || 1.7),
    luma_polarity: els.lumaPolarityInput.value || "auto",
    batch_green_to_black: els.batchGreenToBlackInput.checked,
    batch_green_desaturate: els.batchGreenDesaturateInput.checked,
    batch_semitransparent_to_black: els.batchSemiTransparentToBlackInput.checked,
    batch_semitransparent_to_opaque: els.batchSemiTransparentToOpaqueInput.checked,
  };
}

function applyFormState(snapshot) {
  if (!snapshot) {
    return;
  }

  if (snapshot.keep_every != null) els.keepEveryInput.value = String(snapshot.keep_every);
  if (snapshot.output_scale != null) {
    els.outputScaleInput.value = String(normalizeOutputScalePercent(Number(snapshot.output_scale) * 100));
  } else if (snapshot.target_size != null) {
    const legacyPercent = outputScalePercentFromLegacyTarget(snapshot.target_size);
    if (legacyPercent != null) {
      els.outputScaleInput.value = String(legacyPercent);
    }
  }
  if (snapshot.canvas_mode && [...els.canvasModeInput.options].some((option) => option.value === snapshot.canvas_mode)) {
    els.canvasModeInput.value = snapshot.canvas_mode;
  }
  if (snapshot.reduce_px != null) els.reducePxInput.value = String(snapshot.reduce_px);
  syncSizingControlsForUpload();
  if (snapshot.chroma_enabled != null) els.chromaEnabledInput.checked = Boolean(snapshot.chroma_enabled);
  if (snapshot.matte_mode && [...els.matteModeInput.options].some((option) => option.value === snapshot.matte_mode)) {
    els.matteModeInput.value = snapshot.matte_mode;
  }
  if (snapshot.corridorkey_enabled && !matteModeUsesCorridorKey(els.matteModeInput.value)) {
    if (els.matteModeInput.value === "birefnet") {
      els.matteModeInput.value = "birefnet_corridorkey";
    } else if (els.matteModeInput.value === "birefnet_luma") {
      els.matteModeInput.value = "birefnet_luma_corridorkey";
    } else if (els.matteModeInput.value === "chroma") {
      els.matteModeInput.value = "corridorkey";
    }
  }
  if (snapshot.key_mode) els.keyModeInput.value = snapshot.key_mode;
  if (snapshot.manual_key_hex) els.manualKeyInput.value = snapshot.manual_key_hex;
  applyAutomaticMatteDefaults();
  els.corridorEnabledInput.checked = currentUsesCorridorKey();
  if (
    snapshot.corridorkey_screen &&
    [...els.corridorScreenInput.options].some((option) => option.value === snapshot.corridorkey_screen)
  ) {
    els.corridorScreenInput.value = snapshot.corridorkey_screen;
  }
  enforceAutomaticAiSettings(false);
  if (
    snapshot.luma_polarity &&
    [...els.lumaPolarityInput.options].some((option) => option.value === snapshot.luma_polarity)
  ) {
    els.lumaPolarityInput.value = snapshot.luma_polarity;
  } else {
    els.lumaPolarityInput.value = "auto";
  }
  if (snapshot.batch_green_to_black != null) els.batchGreenToBlackInput.checked = Boolean(snapshot.batch_green_to_black);
  if (snapshot.batch_green_desaturate != null) {
    els.batchGreenDesaturateInput.checked = Boolean(snapshot.batch_green_desaturate);
  }
  if (snapshot.batch_semitransparent_to_black != null) {
    els.batchSemiTransparentToBlackInput.checked = Boolean(snapshot.batch_semitransparent_to_black);
  }
  if (snapshot.batch_semitransparent_to_opaque != null) {
    els.batchSemiTransparentToOpaqueInput.checked = Boolean(snapshot.batch_semitransparent_to_opaque);
  }
  updatePreviewBackground(snapshot.preview_background || state.preview.background, false);
  if (snapshot.preview_interval != null) els.previewIntervalInput.value = String(snapshot.preview_interval);
  state.preview.isReversed = Boolean(snapshot.preview_reversed);
  if (els.previewReverseInput) {
    els.previewReverseInput.checked = state.preview.isReversed;
  }
  if (snapshot.process_preview_zoom) {
    updateProcessPreviewZoom("source", Number(snapshot.process_preview_zoom.source || 100), false);
    updateProcessPreviewZoom("processed", Number(snapshot.process_preview_zoom.processed || 100), false);
  } else {
    updateProcessPreviewZoom("source", 100, false);
    updateProcessPreviewZoom("processed", 100, false);
  }
  if (snapshot.process_preview_background) {
    updateProcessPreviewBackground(
      snapshot.process_preview_background.mode,
      snapshot.process_preview_background.color,
      false
    );
  } else {
    updateProcessPreviewBackground("checkerboard", state.processPreviewBackground.color, false);
  }

  if (snapshot.magic_resize_mode) {
    setMagicResizeMode(snapshot.magic_resize_mode, { clearExisting: false });
  }
  if (snapshot.magic_use_realesrgan != null) {
    setMagicUseRealesrgan(Boolean(snapshot.magic_use_realesrgan), { clearExisting: false });
  }

  if (snapshot.segment) {
    state.segment.start = Number(snapshot.segment.start || 0);
    state.segment.end = Number(snapshot.segment.end || 0);
    if (snapshot.segment.startFrame != null && snapshot.segment.endFrame != null) {
      state.segment.startFrame = Number(snapshot.segment.startFrame || 1);
      state.segment.endFrame = Number(snapshot.segment.endFrame || 1);
      syncSegmentTimesFromFrames();
    } else {
      syncSegmentFramesFromTimes();
    }
    state.segment.confirmed = Boolean(snapshot.segment.confirmed);
  }

  syncManualColorLabel();
  updateChromaVisibility();
  normalizePreviewInterval();
}

function persistSession() {
  if (skipSessionPersistence) {
    return;
  }
  try {
    const selectionOrder = normalizeSelectionOrder();
    const snapshot = {
      upload: state.upload,
      job: state.job,
      exportResult: state.exportResult,
      processPreview: state.processPreview,
      selectedIndices: Array.from(state.selected).sort((a, b) => a - b),
      selectionOrder,
      orderedSelectionMode: state.orderedSelectionMode,
      preview: {
        isPlaying: state.preview.isPlaying,
        currentIndex: state.preview.currentIndex,
        isReversed: state.preview.isReversed,
      },
      form: collectFormState(),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("persistSession failed", error);
  }
}

function restoreSessionFromStorage() {
  let snapshot = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    snapshot = JSON.parse(raw);
  } catch (error) {
    console.warn("restoreSessionFromStorage failed", error);
    return;
  }

  if (!snapshot) {
    return;
  }

  setOrderedSelectionMode(Boolean(snapshot.orderedSelectionMode));

  if (!snapshot.upload && !snapshot.job?.frames) {
    if (snapshot?.form) {
      applyFormState(snapshot.form);
      updateSegmentConfirmationUI();
    }
    return;
  }

  if (snapshot.upload) {
    applyUpload(snapshot.upload, { resetSizing: false });
  } else {
    resetPreviewState();
    state.upload = null;
    state.processPreview = null;
    els.previewPanel.hidden = true;
    els.processPanel.hidden = true;
    resetProcessPreview();
    updateSegmentConfirmationUI();
  }
  applyFormState(snapshot.form);
  if (state.upload) {
    normalizeSegment("end");
    renderSegmentControls();
    updateSegmentConfirmationUI();
    restartSegmentPlayback({ autoplay: false });
  }

  if (snapshot.preview && typeof snapshot.preview.isPlaying === "boolean") {
    state.preview.isPlaying = snapshot.preview.isPlaying;
  }
  if (snapshot.preview && typeof snapshot.preview.isReversed === "boolean") {
    state.preview.isReversed = snapshot.preview.isReversed;
    els.previewReverseInput.checked = state.preview.isReversed;
  }

  if (snapshot.processPreview) {
    state.processPreview = snapshot.processPreview;
    renderProcessPreview();
  }

  if (snapshot.job?.frames) {
    state.job = snapshot.job;
    state.exportResult = snapshot.exportResult || null;
    if (Array.isArray(snapshot.selectedIndices)) {
      state.selected = new Set(
        snapshot.selectedIndices.map((index) => Number(index)).filter((index) => !Number.isNaN(index))
      );
    } else {
      state.selected = new Set(snapshot.job.frames.map((frame) => frame.index));
    }
    state.selectionOrder = Array.isArray(snapshot.selectionOrder)
      ? snapshot.selectionOrder.map((index) => Number(index)).filter((index) => !Number.isNaN(index))
      : Array.from(state.selected);
    normalizeSelectionOrder();
    state.preview.currentIndex = clamp(
      Number(snapshot.preview?.currentIndex || 0),
      0,
      Math.max(snapshot.job.frames.length - 1, 0)
    );
    renderJob();
    if (state.exportResult) {
      renderExportResult();
    }
  } else {
    syncAnimationPreview();
  }

  setStatus("\u5DF2\u6062\u590D\u4E0A\u6B21\u7684\u5DE5\u4F5C\u73B0\u573A\u3002", "success");
}

function startHotReloadPolling() {
  if (hotReloadTimerId !== null) {
    window.clearTimeout(hotReloadTimerId);
    hotReloadTimerId = null;
  }

  const poll = async () => {
    try {
      const data = await apiJson(`/api/app-version?ts=${Date.now()}`);
      const nextVersion = String(data.version || "0");
      const pollMs = Number(data.poll_ms || 1200);
      if (hotReloadVersion === null) {
        hotReloadVersion = nextVersion;
      } else if (nextVersion !== hotReloadVersion) {
        hotReloadVersion = nextVersion;
        persistSession();
        setStatus("\u68C0\u6D4B\u5230\u4EE3\u7801\u53D8\u66F4\uFF0C\u6B63\u5728\u81EA\u52A8\u5237\u65B0...", "success");
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }
      hotReloadTimerId = window.setTimeout(poll, pollMs);
    } catch (error) {
      hotReloadTimerId = window.setTimeout(poll, 1200);
    }
  };

  poll();
}

function bindUploadDropzone() {
  els.uploadDropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    if (els.uploadInput.disabled) {
      return;
    }
    els.uploadInput.click();
  });

  els.uploadDropzone.addEventListener("dragenter", (event) => {
    if (!dragEventHasFiles(event)) {
      return;
    }
    event.preventDefault();
    uploadDragDepth += 1;
    els.uploadDropzone.classList.add("dragging");
  });

  els.uploadDropzone.addEventListener("dragover", (event) => {
    if (!dragEventHasFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    els.uploadDropzone.classList.add("dragging");
  });

  els.uploadDropzone.addEventListener("dragleave", (event) => {
    if (!dragEventHasFiles(event)) {
      return;
    }
    event.preventDefault();
    uploadDragDepth = Math.max(0, uploadDragDepth - 1);
    if (uploadDragDepth === 0) {
      els.uploadDropzone.classList.remove("dragging");
    }
  });

  els.uploadDropzone.addEventListener("drop", async (event) => {
    if (!dragEventHasFiles(event)) {
      return;
    }
    event.preventDefault();
    uploadDragDepth = 0;
    els.uploadDropzone.classList.remove("dragging");
    await uploadSelectedFiles(Array.from(event.dataTransfer?.files || []));
  });
}

function dragEventHasFiles(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes("Files");
}

function setUploadDropzoneBusy(isBusy) {
  els.uploadDropzone.classList.toggle("busy", isBusy);
  els.uploadDropzone.setAttribute("aria-busy", isBusy ? "true" : "false");
  els.uploadDropzone.setAttribute("aria-disabled", isBusy ? "true" : "false");
  els.uploadInput.disabled = isBusy;
}

function currentUploadInfo(upload = state.upload) {
  return upload?.media_info || upload?.video_info || {};
}

function uploadMediaType(upload = state.upload) {
  const info = currentUploadInfo(upload);
  return String(upload?.media_type || info.media_type || "video").toLowerCase();
}

function isImageUpload(upload = state.upload) {
  return uploadMediaType(upload) === "image";
}

function isImageSequenceUpload(upload = state.upload) {
  return uploadMediaType(upload) === "image_sequence";
}

function isVideoUpload(upload = state.upload) {
  return uploadMediaType(upload) === "video";
}

function isSupportedUploadFile(file) {
  if (!file || !file.name) {
    return false;
  }
  const name = String(file.name).toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isSupportedImageFile(file) {
  if (!file || !file.name) {
    return false;
  }
  const name = String(file.name).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function formatSourceModeLabel(ffmpegAccel, sourceMediaType = uploadMediaType()) {
  const type = String(sourceMediaType || "video").toLowerCase();
  if (type === "animation") {
    return "\u81EA\u5B9A\u4E49\u52A8\u753B";
  }
  if (type === "image_sequence") {
    return "\u56FE\u7247\u5E8F\u5217";
  }
  if (type === "image") {
    return "\u9759\u6001\u56FE\u7247";
  }
  return `FFmpeg ${formatFfmpegAccelLabel(ffmpegAccel)}`;
}

function formatMatteModeLabel(matte) {
  const mode = typeof matte === "string" ? matte : (matte?.mode || "chroma");
  let label = "chroma key";
  if (mode === "none") label = "\u4E0D\u53BB\u80CC\u666F";
  if (mode === "birefnet") label = "\u53EA\u7528 BiRefNet";
  if (mode === "corridorkey") label = "\u53EA\u7528 CorridorKey";
  if (mode === "luma") label = "\u53EA\u7528 Luma";
  if (mode === "birefnet_corridorkey") label = "BiRefNet \u7C97\u8499\u7248 / CorridorKey \u7CBE\u4FEE\u8FB9\u7F18";
  if (mode === "birefnet_corridorkey_key") label = "BiRefNet \u540E\u518D\u7528 CorridorKey \u6536\u7D27\u62A0\u56FE";
  if (mode === "birefnet_luma") label = "BiRefNet \u4FDD\u4E3B\u4F53 / Luma \u8865\u4EAE\u90E8";
  if (mode === "birefnet_luma_key") label = "BiRefNet \u540E\u518D\u7528 Luma \u6536\u7D27\u62A0\u56FE";
  if (mode === "birefnet_luma_corridorkey") label = "BiRefNet + Luma \u5408\u5E76\u540E / CorridorKey \u7CBE\u4FEE";
  if (
    mode !== "none" &&
    !matteModeUsesCorridorKey(mode) &&
    typeof matte !== "string" &&
    matte?.corridorkey_enabled
  ) {
    label = `${label} + CorridorKey`;
  }
  return label;
}

function formatCorridorScreenLabel(value) {
  if (value === "blue") return "\u84DD\u5E55";
  if (value === "green") return "\u7EFF\u5E55";
  return "\u81EA\u52A8";
}

function formatMatteDetail(matte) {
  if (!matte) {
    return "";
  }
  if (matte.mode === "none") {
    return "";
  }
  const parts = [];
  if (matteModeUsesBiRefNet(matte.mode) && matte.model_label) {
    parts.push(matte.model_label);
  }
  if (matteModeUsesLuma(matte.mode) && matte.luma_enabled) {
    parts.push(matte.luma_resolved_polarity === "dark" ? "\u53BB\u767D\u5E95" : "\u53BB\u9ED1\u5E95");
  }
  if (matte.resolution) {
    parts.push(matteModeUsesBiRefNet(matte.mode) ? `AI ${matte.resolution}px` : `${matte.resolution}px`);
  }
  if (matte.solid_key_fallback && matte.solid_key_color) {
    parts.push(`\u8272\u952e\u515c\u5e95 ${matte.solid_key_color}`);
  }
  if (matte.corridorkey_enabled) {
    const screen = formatCorridorScreenLabel(matte.corridorkey_screen_color);
    const device = matte.corridorkey_device ? ` / ${matte.corridorkey_device}` : "";
    parts.push(`CorridorKey ${screen}${device}`);
  }
  return parts.join(" / ");
}

function formatCanvasModeLabel(value) {
  if (value === "custom") return "\u539F\u59CB\u5E27\u5C3A\u5BF8";
  if (value === "square_bottom") return "\u65B9\u5F62 / \u5E95\u90E8";
  if (value === "square_center") return "\u65B9\u5F62 / \u5C45\u4E2D";
  return "\u4FDD\u7559\u6E90\u753B\u5E03";
}

function formatOutputScaleLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
  }
  return `${Math.round(numeric * 100)}%`;
}

function formatSizeLabel(width, height) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
    return "";
  }
  return `${Math.round(safeWidth)} \u00d7 ${Math.round(safeHeight)}`;
}

async function importFromPath() {
  const path = els.pathInput.value.trim();
  if (!path) {
    setStatus("\u5148\u586B\u4E00\u4E2A\u672C\u5730\u89C6\u9891\u6216\u56FE\u7247\u7684\u7EDD\u5BF9\u8DEF\u5F84\u3002", "error");
    return;
  }

  await withBusy(els.importPathButton, async () => {
    setStatus("\u6B63\u5728\u5BFC\u5165\u672C\u5730\u7D20\u6750\u8DEF\u5F84...");
    const data = await apiJson("/api/import-path", {
      method: "POST",
      body: { path },
    });
    applyUpload(data.upload);
    setStatus(`\u5df2\u5bfc\u5165 ${data.upload.display_name}\u3002`, "success");
  });
}

function renderOutputPath(payload) {
  if (!els.outputPathInput || !payload) {
    return;
  }
  els.outputPathInput.value = payload.path || "";
  els.outputPathInput.placeholder = payload.default_path || "D:\\sprite-video-lab-exports";
}

async function loadOutputPath() {
  try {
    const data = await apiJson("/api/output-path");
    renderOutputPath(data.output_path);
  } catch (error) {
    console.warn("loadOutputPath failed", error);
  }
}

async function selectOutputPath() {
  await withBusy(els.saveOutputPathButton, async () => {
    setStatus("\u8BF7\u5728\u5F39\u51FA\u7A97\u53E3\u91CC\u9009\u62E9\u8F93\u51FA\u6587\u4EF6\u5939...");
    const data = await apiJson("/api/select-output-path", { method: "POST" });
    renderOutputPath(data.output_path);
    if (data.cancelled) {
      setStatus("\u5DF2\u53D6\u6D88\u8BBE\u7F6E\u8F93\u51FA\u8DEF\u5F84\u3002");
      return;
    }
    setStatus(`\u8F93\u51FA\u8DEF\u5F84\u5DF2\u8BBE\u7F6E\uFF1A${data.output_path.path}`, "success");
  });
}

async function clearRuntimeFiles() {
  const confirmed = window.confirm(
    "确定清空 Sprite Video Lab 的全部内部文件吗？\n\n" +
      "将删除导入副本、处理帧、预览、MAGIC/线稿缓存，以及输出目录中由本程序创建的时间戳导出文件夹。\n" +
      "不会删除已经下载/另存的文件，也不会删除输出目录中的其他文件。\n\n" +
      "此操作无法撤销。"
  );
  if (!confirmed) {
    return;
  }

  await withBusy(els.clearRuntimeFilesButton, async () => {
    setStatus("正在清空 WebApp 内部文件...");
    await apiJson("/api/clear-runtime-files", {
      method: "POST",
      body: { confirmed: true },
    });
    skipSessionPersistence = true;
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

async function handleUploadInputChange() {
  await uploadSelectedFiles(Array.from(els.uploadInput.files || []));
  els.uploadInput.value = "";
}

async function uploadSelectedFiles(files) {
  if (!files.length) {
    return;
  }
  if (files.length > 1 && !files.every(isSupportedImageFile)) {
    setStatus("\u591A\u6587\u4EF6\u5BFC\u5165\u53EA\u652F\u6301\u56FE\u7247\u5E8F\u5217\uFF0C\u8BF7\u4E00\u6B21\u9009\u5165\u591A\u5F20 PNG/JPG/WebP/BMP\u3002", "error");
    return;
  }
  if (files.length === 1 && !isSupportedUploadFile(files[0])) {
    setStatus("\u53EA\u652F\u6301\u89C6\u9891\u3001GIF \u52A8\u56FE\u3001\u5355\u5F20\u56FE\u7247\u6216\u591A\u56FE\u5E8F\u5217\uFF1A.mp4 / .mov / .mkv / .webm / .gif / .png / .jpg / .jpeg / .webp / .bmp\u3002", "error");
    return;
  }

  const form = new FormData();
  files.forEach((file) => {
    form.append("video", file, file.webkitRelativePath || file.name);
  });
  const isSequence = files.length > 1;

  setUploadDropzoneBusy(true);
  await withBusy(els.importPathButton, async () => {
    try {
      setStatus(isSequence ? `\u6B63\u5728\u6309\u6587\u4EF6\u540D\u8F7D\u5165 ${files.length} \u5F20\u56FE\u7247...` : `\u6b63\u5728\u8F7D\u5165 ${files[0].name}...`);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "\u4E0A\u4F20\u5931\u8D25");
      }
      applyUpload(data.upload);
      setStatus(
        isSequence
          ? `\u5DF2\u6309\u6587\u4EF6\u540D\u987A\u5E8F\u8F7D\u5165 ${data.upload.media_info?.frame_count || files.length} \u5F20\u56FE\u7247\u3002`
          : `\u5DF2\u8F7D\u5165 ${data.upload.display_name}\u3002`,
        "success"
      );
    } finally {
      setUploadDropzoneBusy(false);
      uploadDragDepth = 0;
      els.uploadDropzone.classList.remove("dragging");
      els.uploadInput.value = "";
    }
  });
}

function sortFilesByDisplayName(files) {
  return [...files].sort((a, b) => {
    const aName = a.webkitRelativePath || a.name || "";
    const bName = b.webkitRelativePath || b.name || "";
    return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
  });
}

async function importCustomAnimationFrames(files, button) {
  const imageFiles = sortFilesByDisplayName(files).filter(isSupportedImageFile);
  if (imageFiles.length === 0) {
    setStatus("\u8BF7\u9009\u62E9 PNG / JPG / WebP / BMP \u5E8F\u5217\u5E27\u3002", "error");
    return;
  }

  const form = new FormData();
  imageFiles.forEach((file) => {
    form.append("frames", file, file.webkitRelativePath || file.name);
  });

  await withBusy(button, async () => {
    stopPreviewTimer();
    setStatus(`\u6B63\u5728\u6309\u6587\u4EF6\u540D\u5BFC\u5165 ${imageFiles.length} \u5E27...`);
    const data = await apiJson("/api/import-animation", {
      method: "POST",
      body: form,
    });

    state.upload = null;
    state.processPreview = null;
    state.job = data.job;
    state.exportResult = null;
    clearMagicPreview();
    state.selected = new Set(data.job.frames.map((frame) => frame.index));
    state.selectionOrder = data.job.frames.map((frame) => frame.index);
    setOrderedSelectionMode(false);
    state.preview.currentIndex = 0;
    state.preview.isPlaying = true;
    els.previewReverseInput.checked = state.preview.isReversed;
    els.previewPanel.hidden = true;
    els.processPanel.hidden = true;
    resetProcessPreview();
    updateSegmentConfirmationUI();
    renderJob();
    setStatus(`\u5DF2\u6309\u6587\u4EF6\u540D\u987A\u5E8F\u5BFC\u5165 ${data.job.frame_count} \u5E27\u3002`, "success");
  });
}

function clearPreviewFrames() {
  stopPreviewTimer();
  resetPreviewState();
  state.job = null;
  state.exportResult = null;
  clearMagicPreview();
  state.selected = new Set();
  state.selectionOrder = [];
  setOrderedSelectionMode(false);
  els.jobSummary.innerHTML = "";
  els.frameGrid.innerHTML = "";
  els.exportResult.hidden = true;
  els.exportResult.innerHTML = "";
  showAnimationWorkbench();
  renderSelectionCount();
  drawPreviewPlaceholder();
  updatePreviewControls(0);
  persistSession();
  setStatus("\u5DF2\u6E05\u7A7A\u53C2\u4E0E\u52A8\u753B\u9884\u89C8\u7684\u5E27\u3002", "success");
}

function showAnimationWorkbench() {
  els.resultPanel.hidden = false;
  if (!state.job) {
    els.jobSummary.innerHTML = "";
    els.frameGrid.innerHTML = "";
    els.exportResult.hidden = true;
    els.exportResult.innerHTML = "";
    renderSelectionCount();
    syncAnimationPreview(false);
  }
  syncResultActions();
}

function syncResultActions() {
  const hasJob = Boolean(state.job);
  const hasSelection = hasJob && state.selected.size > 0;
  els.openProcessedButton.disabled = !hasJob || !state.job?.processed_dir;
  els.exportButton.disabled = !hasSelection;
  [els.exportFramesButton, els.exportSpriteSheetButton, els.exportMovButton, els.exportGifButton].forEach((button) => {
    button.disabled = !hasSelection;
  });
  els.magicButton.disabled = !hasSelection || state.magicInFlight;
  els.selectAllButton.disabled = !hasJob;
  els.selectNoneButton.disabled = !hasJob;
  els.selectOddButton.disabled = !hasJob;
  els.selectEvenButton.disabled = !hasJob;
  els.invertSelectionButton.disabled = !hasJob;
  els.orderedSelectionInput.disabled = !hasJob;
}

function resetSizingControlsForNewUpload() {
  els.outputScaleInput.value = String(OUTPUT_SCALE_DEFAULT_PERCENT);
  els.reducePxInput.value = "0";
  syncSizingControlsForUpload();
}

function syncSizingControlsForUpload() {
  const forceSourceCanvas = isVideoUpload();
  if (forceSourceCanvas) {
    els.canvasModeInput.value = "auto";
    els.reducePxInput.value = "0";
  }
  els.canvasModeInput.disabled = forceSourceCanvas;
  els.reducePxInput.disabled = forceSourceCanvas;
}

function applyUpload(upload, { resetSizing = true } = {}) {
  resetPreviewState();
  state.upload = upload;
  state.job = null;
  state.exportResult = null;
  state.processPreview = null;
  clearMagicPreview();
  state.selected = new Set();
  state.selectionOrder = [];
  setOrderedSelectionMode(false);
  if (resetSizing) {
    resetSizingControlsForNewUpload();
  }
  syncSizingControlsForUpload();

  const info = currentUploadInfo(upload);
  const mediaType = uploadMediaType(upload);
  const isSequence = mediaType === "image_sequence";
  state.segment.start = 0;
  state.segment.startFrame = 1;
  state.segment.endFrame = mediaType === "video" || isSequence ? getSegmentFrameCount(upload) : 1;
  state.segment.end = mediaType === "video" ? segmentFrameToTime(getSegmentFrameCount(upload), "end", upload) : 0;
  state.segment.confirmed = true;
  normalizeSegment("end");

  els.videoName.textContent = upload.display_name || (mediaType === "image" ? "\u672a\u547d\u540d\u56fe\u7247" : isSequence ? "\u672a\u547d\u540d\u56fe\u7247\u5e8f\u5217" : "\u672a\u547d\u540d\u89c6\u9891");
  els.videoSize.textContent = info.width && info.height ? `${info.width} \u00d7 ${info.height}` : "-";
  els.videoFps.textContent = mediaType === "image" ? "\u5355\u5e27\u56fe\u7247" : isSequence ? `${getSegmentFrameCount(upload)} \u5f20\u56fe\u7247` : (info.fps ? `${Number(info.fps).toFixed(2)} fps` : "-");
  els.videoDuration.textContent = mediaType === "image" ? "\u5355\u5f20\u56fe\u7247" : isSequence ? "\u6309\u6587\u4ef6\u540d\u6392\u5217" : (Number(info.duration || 0) > 0 ? formatSeconds(info.duration) : "-");

  els.previewPanel.hidden = false;
  els.processPanel.hidden = false;
  els.resultPanel.hidden = false;
  els.exportResult.hidden = true;
  els.exportResult.innerHTML = "";
  els.frameGrid.innerHTML = "";
  els.jobSummary.innerHTML = "";
  resetProcessPreview();
  showAnimationWorkbench();
  syncAnimationPreview();

  const mediaUrl = upload.media_url || upload.video_url;
  if (mediaType === "image" || isSequence) {
    els.videoPreview.pause();
    els.videoPreview.hidden = true;
    els.videoPreview.removeAttribute("src");
    els.videoPreview.load();
    els.mediaPreviewImage.src = mediaUrl;
    els.mediaPreviewImage.hidden = false;
  } else {
    els.mediaPreviewImage.hidden = true;
    els.mediaPreviewImage.removeAttribute("src");
    els.videoPreview.hidden = false;
    muteVideoPreview();
    els.videoPreview.src = mediaUrl;
    els.videoPreview.load();
  }
  syncSegmentBounds();
  renderSegmentControls();
  updateSegmentConfirmationUI();
  persistSession();
}

function resetProcessPreview() {
  state.processPreview = null;
  resetProcessPreviewView("source", false);
  resetProcessPreviewView("processed", false);
  els.previewSourceImage.hidden = true;
  els.previewProcessedImage.hidden = true;
  els.previewSourceImage.removeAttribute("src");
  els.previewProcessedImage.removeAttribute("src");
  setProcessPreviewStageActive("source", false);
  setProcessPreviewStageActive("processed", false);
  els.previewSourceEmpty.hidden = false;
  els.previewProcessedEmpty.hidden = false;
  els.processPreviewTimeLabel.textContent = "\u53D6\u6837\u65F6\u95F4 -";
  els.processPreviewKeyLabel.textContent = "\u53D6\u6837\u65B9\u5F0F - / \u62A0\u56FE -";
  updateSavePreviewButton();
}

function renderProcessPreview() {
  if (!state.processPreview) {
    resetProcessPreview();
    return;
  }

  const sourceModeLabel = formatSourceModeLabel(
    state.processPreview.ffmpeg_accel,
    state.processPreview.source_media_type || uploadMediaType()
  );
  resetProcessPreviewPan("source");
  resetProcessPreviewPan("processed");
  els.previewSourceImage.src = state.processPreview.source_url;
  els.previewProcessedImage.src = state.processPreview.processed_url;
  els.previewSourceImage.hidden = false;
  els.previewProcessedImage.hidden = false;
  setProcessPreviewStageActive("source", true);
  setProcessPreviewStageActive("processed", true);
  els.previewSourceEmpty.hidden = true;
  els.previewProcessedEmpty.hidden = true;
  const previewOptions = state.processPreview.options || {};
  const previewOutputSize = formatSizeLabel(previewOptions.output_width, previewOptions.output_height);
  const previewTimeLabel = isImageUpload()
    ? "\u5355\u5F20\u56FE\u7247\u9884\u89C8"
    : isImageSequenceUpload()
    ? `\u56FE\u7247\u5E8F\u5217\u7B2C ${state.processPreview.sample_frame || state.segment.startFrame || 1} \u5E27`
    : `\u53D6\u6837\u65F6\u95F4 ${formatSeconds(state.processPreview.sample_time || 0)}`;
  els.processPreviewTimeLabel.textContent = previewOutputSize
    ? `${previewTimeLabel} / \u8F93\u51FA ${previewOutputSize}`
    : previewTimeLabel;
  const matte = state.processPreview.matte || { mode: state.processPreview.options?.matte_mode || "chroma" };
  const matteLabel = formatMatteModeLabel(matte);
  const matteDetail = formatMatteDetail(matte);
  const chromaDetail = matte.mode === "chroma" ? ` / \u80CC\u666F\u8272 ${state.processPreview.key_color || "-"}` : "";
  els.processPreviewKeyLabel.textContent = `${sourceModeLabel} / ${matteLabel}${matteDetail ? ` / ${matteDetail}` : ""}${chromaDetail}`;
  updateSavePreviewButton();
  persistSession();
}

function syncSegmentBounds() {
  if (isImageUpload()) {
    [els.startRange, els.endRange].forEach((element) => {
      element.step = "1";
      element.min = "1";
      element.max = "1";
    });
    [els.startInput, els.endInput].forEach((element) => {
      element.max = "1";
    });
    return;
  }
  const frameCount = getSegmentFrameCount();
  [els.startRange, els.endRange].forEach((element) => {
    element.step = "1";
    element.min = "1";
    element.max = String(frameCount);
  });
  [els.startInput, els.endInput].forEach((element) => {
    element.max = String(frameCount);
  });
}

function normalizeSegment(changedKey) {
  if (isImageUpload()) {
    state.segment.start = 0;
    state.segment.end = 0;
    state.segment.startFrame = 1;
    state.segment.endFrame = 1;
    return;
  }
  let startFrame = clampSegmentFrame(state.segment.startFrame);
  let endFrame = clampSegmentFrame(state.segment.endFrame);

  if (endFrame < startFrame) {
    if (changedKey === "start") {
      endFrame = startFrame;
    } else {
      startFrame = endFrame;
    }
  }

  state.segment.startFrame = startFrame;
  state.segment.endFrame = endFrame;
  syncSegmentTimesFromFrames();
}

function muteVideoPreview() {
  els.videoPreview.defaultMuted = true;
  els.videoPreview.muted = true;
  try {
    els.videoPreview.volume = 0;
  } catch (error) {}
}

function playVideoPreviewMuted() {
  muteVideoPreview();
  const playPromise = els.videoPreview.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
  startSegmentPlaybackMonitor();
}

function restartSegmentPlayback({ autoplay = true } = {}) {
  if (!state.upload || !isVideoUpload() || els.videoPreview.readyState < 1) {
    return;
  }
  stopSegmentPlaybackMonitor();
  const segmentStart = getSegmentPlaybackStartTime();
  els.videoPreview.currentTime = segmentStart;
  els.currentTimeLabel.textContent = `\u5f53\u524d ${formatSeconds(segmentStart)}`;
  updateVideoProgress(segmentStart);
  if (autoplay) {
    playVideoPreviewMuted();
  }
}

function getSegmentPlaybackStartTime() {
  if (!state.upload || !isVideoUpload()) {
    return 0;
  }
  const duration = Math.max(Number(currentUploadInfo().duration || 0), 0);
  const segmentStart = clamp(Number(state.segment.start || 0), 0, duration);
  const segmentEnd = clamp(Number(state.segment.end || duration), segmentStart, duration);
  const guard = clamp(getSegmentFrameStep() * 0.1, 0.001, 0.006);
  return segmentEnd > segmentStart ? Math.min(segmentEnd, segmentStart + guard) : segmentStart;
}

function getSegmentPlaybackEndTime() {
  if (!state.upload || !isVideoUpload()) {
    return 0;
  }
  const duration = Math.max(Number(currentUploadInfo().duration || 0), 0);
  const segmentStart = clamp(Number(state.segment.start || 0), 0, duration);
  const segmentEnd = clamp(Number(state.segment.end || duration), segmentStart, duration);
  const frameStep = getSegmentFrameStep();
  const guard = clamp(frameStep * 0.35, 0.004, 0.02);
  return Math.max(segmentStart, segmentEnd - guard);
}

function shouldLoopSegmentPlayback(currentTime = els.videoPreview.currentTime || 0) {
  return (
    state.upload &&
    isVideoUpload() &&
    state.segment.end > state.segment.start &&
    Number(currentTime || 0) >= getSegmentPlaybackEndTime()
  );
}

function startSegmentPlaybackMonitor() {
  stopSegmentPlaybackMonitor();
  if (!state.upload || !isVideoUpload()) {
    return;
  }
  const tick = () => {
    state.segmentPlaybackRafId = null;
    if (!state.upload || !isVideoUpload() || els.videoPreview.paused || els.videoPreview.ended) {
      return;
    }
    const current = els.videoPreview.currentTime || 0;
    els.currentTimeLabel.textContent = `\u5f53\u524d ${formatSeconds(current)}`;
    updateVideoProgress(current);
    if (shouldLoopSegmentPlayback(current)) {
      restartSegmentPlayback({ autoplay: true });
      return;
    }
    state.segmentPlaybackRafId = window.requestAnimationFrame(tick);
  };
  state.segmentPlaybackRafId = window.requestAnimationFrame(tick);
}

function stopSegmentPlaybackMonitor() {
  if (state.segmentPlaybackRafId != null) {
    window.cancelAnimationFrame(state.segmentPlaybackRafId);
    state.segmentPlaybackRafId = null;
  }
}

function updateVideoProgress(currentTime = 0) {
  if (!els.videoProgressFill) {
    return;
  }

  const setProgress = (percent) => {
    const progress = clamp(Number(percent || 0), 0, 100);
    els.videoProgressFill.style.setProperty("--progress", `${progress * 3.6}deg`);
    if (els.videoProgressLabel) {
      els.videoProgressLabel.textContent = `${Math.round(progress)}%`;
    }
    if (els.videoProgress) {
      els.videoProgress.setAttribute("aria-valuenow", String(Math.round(progress)));
    }
  };

  if (!state.upload || !isVideoUpload()) {
    setProgress(0);
    return;
  }

  const duration = Math.max(Number(currentUploadInfo().duration || 0), 0);
  const segmentStart = clamp(Number(state.segment.start || 0), 0, duration);
  const segmentEnd = clamp(Number(state.segment.end || duration), segmentStart, duration);
  const segmentLength = Math.max(segmentEnd - segmentStart, 0.01);
  const normalizedCurrent = clamp(Number(currentTime || 0), segmentStart, segmentEnd);
  const progress = ((normalizedCurrent - segmentStart) / segmentLength) * 100;
  setProgress(progress);
}

function renderSegmentControls() {
  const startFrame = clampSegmentFrame(state.segment.startFrame);
  const endFrame = clampSegmentFrame(state.segment.endFrame);
  els.startRange.value = String(startFrame);
  els.startInput.value = String(startFrame);
  els.endRange.value = String(endFrame);
  els.endInput.value = String(endFrame);
  els.segmentLength.textContent = `${Math.max(1, endFrame - startFrame + 1)} \u5E27`;
  updateVideoProgress(isVideoUpload() ? (els.videoPreview.currentTime || state.segment.start || 0) : 0);
}

function updateSegmentConfirmationUI() {
  const hasUpload = Boolean(state.upload);
  const isImage = isImageUpload();
  const isSequence = isImageSequenceUpload();
  const startField = els.startRange.closest(".field");
  const endField = els.endRange.closest(".field");
  const segmentSummary = els.segmentLength.closest(".segment-summary");
  if (startField) startField.hidden = isImage;
  if (endField) endField.hidden = isImage;
  if (segmentSummary) segmentSummary.hidden = isImage;
  els.videoToolbar.hidden = !isVideoUpload() || !hasUpload;
  els.videoProgress.hidden = !isVideoUpload() || !hasUpload;

  if (isImage) {
    state.segment.start = 0;
    state.segment.end = 0;
    state.segment.confirmed = true;
    els.segmentConfirmStatus.className = "segment-status image";
    els.segmentConfirmStatus.textContent = "\u5355\u5F20\u56FE\u7247\u6A21\u5F0F";
    els.segmentConfirmHint.textContent = "\u65E0\u9700\u8C03\u6574\u65F6\u95F4\u8303\u56F4\u3002\u5F53\u524D\u53C2\u6570\u4F1A\u76F4\u63A5\u4F5C\u7528\u4E8E\u8FD9 1 \u5E27\u3002";
    els.previewFrameButton.disabled = !hasUpload;
    els.processButton.disabled = !hasUpload;
    els.processStepShell.classList.remove("locked");
    els.processLockNote.hidden = true;
    updateVideoProgress(0);
    return;
  }

  if (isSequence) {
    state.segment.confirmed = true;
    state.segment.startFrame = clampSegmentFrame(state.segment.startFrame);
    state.segment.endFrame = clampSegmentFrame(state.segment.endFrame);
    els.segmentConfirmStatus.className = "segment-status confirmed";
    els.segmentConfirmStatus.textContent = `\u56FE\u7247\u5E8F\u5217 \u7B2C ${state.segment.startFrame} \u5E27 - \u7B2C ${state.segment.endFrame} \u5E27`;
    els.segmentConfirmHint.textContent = "\u5E8F\u5217\u4F1A\u6309\u6587\u4EF6\u540D\u987A\u5E8F\u5904\u7406\uFF0C\u53EF\u4EE5\u8C03\u6574\u8D77\u6B62\u5E27\u3002\u518D\u6B21\u62D6\u5165\u591A\u56FE\u4F1A\u66FF\u6362\u5F53\u524D\u8F93\u5165\uFF0C\u4E0D\u4F1A\u8FFD\u52A0\u3002";
    els.previewFrameButton.disabled = !hasUpload;
    els.processButton.disabled = !hasUpload;
    els.processStepShell.classList.remove("locked");
    els.processLockNote.hidden = true;
    updateVideoProgress(0);
    return;
  }

  if (!hasUpload) {
    state.segment.confirmed = false;
    els.segmentConfirmStatus.className = "segment-status";
    els.segmentConfirmStatus.textContent = "\u5148\u5BFC\u5165\u7D20\u6750";
    els.segmentConfirmHint.textContent = "\u8F7D\u5165\u89C6\u9891\u540E\uFF0C\u8FD9\u91CC\u4F1A\u5B9E\u65F6\u9884\u89C8\u5E76\u5FAA\u73AF\u5F53\u524D\u9009\u533A\u3002";
    els.previewFrameButton.disabled = true;
    els.processButton.disabled = true;
    els.processStepShell.classList.add("locked");
    els.processLockNote.hidden = false;
    updateVideoProgress(0);
    return;
  }

  state.segment.confirmed = true;
  els.segmentConfirmStatus.className = "segment-status confirmed";
  els.segmentConfirmStatus.textContent = `\u5F53\u524D\u9009\u533A \u7B2C ${state.segment.startFrame} \u5E27 - \u7B2C ${state.segment.endFrame} \u5E27`;
  els.segmentConfirmHint.textContent = "\u62D6\u52A8\u8D77\u70B9\u6216\u7EC8\u70B9\u540E\uFF0C\u5DE6\u4FA7\u89C6\u9891\u4F1A\u7ACB\u5373\u8DF3\u56DE\u65B0\u8D77\u70B9\u5E76\u9759\u97F3\u5FAA\u73AF\u3002";
  els.previewFrameButton.disabled = false;
  els.processButton.disabled = false;
  els.processStepShell.classList.remove("locked");
  els.processLockNote.hidden = true;
  updateVideoProgress(els.videoPreview.currentTime || state.segment.start || 0);
}

async function processVideo() {
  if (!state.upload) {
    setStatus("\u5148\u5BFC\u5165\u89C6\u9891\u3001\u56FE\u7247\u6216\u591A\u56FE\u5E8F\u5217\uFF0C\u518D\u5904\u7406\u3002", "error");
    return;
  }

  const payload = collectProcessingPayload();

  await withBusy(els.processButton, async () => {
    stopPreviewTimer();
    const matteMode = currentMatteMode();
    const matteLabel = formatMatteModeLabel(matteMode);
    setStatus(
      matteMode !== "none"
        ? `\u6B63\u5728\u8FD0\u884C ${matteLabel} \u62A0\u56FE\u3002`
        : isImageUpload()
        ? "\u6B63\u5728\u5904\u7406\u5355\u5F20\u56FE\u7247\u7684\u900F\u660E\u8FB9\u7F18\u548C\u7F29\u653E..."
        : isImageSequenceUpload()
        ? "\u6B63\u5728\u6309\u6587\u4EF6\u540D\u987A\u5E8F\u5904\u7406\u56FE\u7247\u5E8F\u5217..."
        : "\u6b63\u5728\u62bd\u5e27\u5e76\u5904\u7406\u900f\u660e\u8fb9\u7f18\uff0c\u8fd9\u4e00\u6b65\u53ef\u80fd\u9700\u8981\u51e0\u5341\u79d2\u3002"
    );
    const data = await apiJson("/api/process", {
      method: "POST",
      body: payload,
    });
    state.job = data.job;
    state.exportResult = null;
    clearMagicPreview();
    state.selected = new Set(data.job.frames.map((frame) => frame.index));
    state.selectionOrder = data.job.frames.map((frame) => frame.index);
    setOrderedSelectionMode(false);
    state.preview.currentIndex = 0;
    renderJob();
    setStatus(
      `\u5904\u7406\u5b8c\u6210\uff0c\u5171\u5f97\u5230 ${data.job.frame_count} \u5e27\uff0c${formatSourceModeLabel(data.job.ffmpeg_accel, data.job.source_media_type)}\u3002`,
      "success"
    );
  });
}

async function previewCurrentFrame() {
  if (!state.upload) {
    setStatus("\u5148\u5BFC\u5165\u89C6\u9891\u3001\u56FE\u7247\u6216\u591A\u56FE\u5E8F\u5217\uFF0C\u518D\u9884\u89C8\u53C2\u6570\u6548\u679C\u3002", "error");
    return;
  }

  const duration = Number(currentUploadInfo().duration || 0);
  const sampleFrame = isImageSequenceUpload() ? clampSegmentFrame(state.segment.startFrame) : 1;
  const rawCurrentTime = isImageUpload() || isImageSequenceUpload() ? 0 : Number(els.videoPreview.currentTime || state.segment.start || 0);
  const segmentStart = isImageUpload() || isImageSequenceUpload() ? 0 : getSegmentPlaybackStartTime();
  const segmentEnd = isImageUpload() || isImageSequenceUpload() ? 0 : getSegmentPlaybackEndTime();
  const sampleTime = isImageUpload() || isImageSequenceUpload()
    ? 0
    : clamp(rawCurrentTime, segmentStart, Math.max(segmentStart, segmentEnd));
  const payload = {
    ...collectProcessingPayload(),
    sample_time: sampleTime,
    sample_frame: sampleFrame,
  };

  await withBusy(els.previewFrameButton, async () => {
    const matteMode = currentMatteMode();
    const matteLabel = formatMatteModeLabel(matteMode);
    setStatus(
      matteMode !== "none"
        ? `\u6B63\u5728\u9884\u89C8 ${matteLabel} \u62A0\u56FE\u3002`
        : isImageUpload()
        ? "\u6B63\u5728\u5957\u7528\u53C2\u6570\u9884\u89C8\u5355\u5F20\u56FE\u7247..."
        : isImageSequenceUpload()
        ? `\u6B63\u5728\u9884\u89C8\u56FE\u7247\u5E8F\u5217\u7B2C ${sampleFrame} \u5E27...`
        : "\u6b63\u5728\u62BD\u53D6\u5F53\u524D\u5E27\u5E76\u5957\u7528\u53C2\u6570..."
    );
    const data = await apiJson("/api/preview-frame", {
      method: "POST",
      body: payload,
    });
    state.processPreview = data.preview;
    renderProcessPreview();
    setStatus(
      isImageUpload()
        ? `\u5355\u5F20\u56FE\u7247\u9884\u89C8\u5DF2\u66F4\u65B0\uFF0C${formatSourceModeLabel(data.preview.ffmpeg_accel, data.preview.source_media_type)}\u3002`
        : isImageSequenceUpload()
        ? `\u56FE\u7247\u5E8F\u5217\u7B2C ${data.preview.sample_frame || sampleFrame} \u5E27\u9884\u89C8\u5DF2\u66F4\u65B0\uFF0C${formatSourceModeLabel(data.preview.ffmpeg_accel, data.preview.source_media_type)}\u3002`
        : `\u5355\u5E27\u9884\u89C8\u5DF2\u66F4\u65B0\uFF0C\u53D6\u6837\u65F6\u95F4 ${formatSeconds(sampleTime)}\uFF0C${formatSourceModeLabel(data.preview.ffmpeg_accel, data.preview.source_media_type)}\u3002`,
      "success"
    );
  });
}

async function downloadProcessPreviewResult() {
  if (!state.processPreview?.processed_url) {
    setStatus("\u5148\u9884\u89C8\u5F53\u524D\u5E27\uFF0C\u518D\u4E0B\u8F7D\u9884\u89C8\u56FE\u3002", "error");
    return;
  }
  if (!state.processPreview?.preview_id) {
    setStatus("\u8FD9\u5F20\u9884\u89C8\u56FE\u7F3A\u5C11\u6807\u8BC6\uFF0C\u8BF7\u91CD\u65B0\u9884\u89C8\u4E00\u6B21\u3002", "error");
    return;
  }

  await withBusy(els.savePreviewButton, async () => {
    const filename = buildPreviewDownloadFilename();
    triggerFileDownload(state.processPreview.processed_url, filename);
    setStatus(`\u5DF2\u5F00\u59CB\u4E0B\u8F7D\u9884\u89C8\u56FE\uFF1A${filename}`, "success");
  });
}

async function applyGreenToBlackPreview() {
  if (!state.processPreview?.preview_id) {
    setStatus("\u5148\u9884\u89C8\u5F53\u524D\u5E27\uFF0C\u518D\u5904\u7406\u6B8B\u7559\u7EFF\u8272\u3002", "error");
    return;
  }

  await withBusy(els.greenToBlackButton, async () => {
    setStatus("\u6B63\u5728\u628A\u9884\u89C8\u56FE\u91CC\u7684\u6B8B\u7559\u7EFF\u8272\u6D82\u9ED1...");
    const data = await apiJson("/api/preview-green-to-black", {
      method: "POST",
      body: {
        preview_id: state.processPreview.preview_id,
        threshold: 42,
        dominance: 24,
      },
    });
    state.processPreview = data.preview;
    renderProcessPreview();
    const changed = Number(data.preview?.postprocess?.green_to_black?.changed_pixels || 0);
    setStatus(`\u6B8B\u7EFF\u6D82\u9ED1\u5B8C\u6210\uFF0C\u5904\u7406\u4E86 ${changed.toLocaleString()} \u4E2A\u50CF\u7D20\u3002`, "success");
  });
}

async function applyGreenDesaturatePreview() {
  if (!state.processPreview?.preview_id) {
    setStatus("\u5148\u9884\u89C8\u5F53\u524D\u5E27\uFF0C\u518D\u5904\u7406\u6B8B\u7559\u7EFF\u8272\u3002", "error");
    return;
  }

  await withBusy(els.greenDesaturateButton, async () => {
    setStatus("\u6B63\u5728\u628A\u9884\u89C8\u56FE\u91CC\u7684\u6B8B\u7559\u7EFF\u8272\u53BB\u9971\u548C...");
    const data = await apiJson("/api/preview-green-desaturate", {
      method: "POST",
      body: {
        preview_id: state.processPreview.preview_id,
        threshold: 42,
        dominance: 24,
      },
    });
    state.processPreview = data.preview;
    renderProcessPreview();
    const changed = Number(data.preview?.postprocess?.green_desaturate?.changed_pixels || 0);
    setStatus(`\u6B8B\u7EFF\u53BB\u9971\u548C\u5B8C\u6210\uFF0C\u5904\u7406\u4E86 ${changed.toLocaleString()} \u4E2A\u50CF\u7D20\u3002`, "success");
  });
}

async function applySemiTransparentToBlackPreview() {
  if (!state.processPreview?.preview_id) {
    setStatus("\u5148\u9884\u89C8\u5F53\u524D\u5E27\uFF0C\u518D\u5904\u7406\u534A\u900F\u660E\u50CF\u7D20\u3002", "error");
    return;
  }

  await withBusy(els.semiTransparentToBlackButton, async () => {
    setStatus("\u6B63\u5728\u628A\u9884\u89C8\u56FE\u91CC\u7684\u534A\u900F\u660E\u50CF\u7D20\u6D82\u9ED1...");
    const data = await apiJson("/api/preview-semitransparent-to-black", {
      method: "POST",
      body: {
        preview_id: state.processPreview.preview_id,
        alpha_min: 1,
        alpha_max: 254,
      },
    });
    state.processPreview = data.preview;
    renderProcessPreview();
    const changed = Number(data.preview?.postprocess?.semitransparent_to_black?.changed_pixels || 0);
    setStatus(`\u534A\u900F\u6D82\u9ED1\u5B8C\u6210\uFF0C\u5904\u7406\u4E86 ${changed.toLocaleString()} \u4E2A\u50CF\u7D20\u3002`, "success");
  });
}

async function applySemiTransparentToOpaquePreview() {
  if (!state.processPreview?.preview_id) {
    setStatus("\u5148\u9884\u89C8\u5F53\u524D\u5E27\uFF0C\u518D\u628A\u534A\u900F\u660E\u50CF\u7D20\u53D8\u6210\u4E0D\u900F\u660E\u3002", "error");
    return;
  }

  await withBusy(els.semiTransparentToOpaqueButton, async () => {
    setStatus("\u6B63\u5728\u4FDD\u7559\u534A\u900F\u50CF\u7D20\u989C\u8272\uFF0C\u5E76\u628A alpha \u63D0\u5230\u4E0D\u900F\u660E...");
    const data = await apiJson("/api/preview-semitransparent-to-opaque", {
      method: "POST",
      body: {
        preview_id: state.processPreview.preview_id,
        alpha_min: 1,
        alpha_max: 254,
      },
    });
    state.processPreview = data.preview;
    renderProcessPreview();
    const changed = Number(data.preview?.postprocess?.semitransparent_to_opaque?.changed_pixels || 0);
    setStatus(`\u534A\u900F\u53D8\u4E0D\u900F\u660E\u5B8C\u6210\uFF0C\u5904\u7406\u4E86 ${changed.toLocaleString()} \u4E2A\u50CF\u7D20\u3002`, "success");
  });
}

function buildPreviewDownloadFilename() {
  const sourceName = stripFileExtension(state.upload?.display_name || "");
  const safeSourceName = sanitizeDownloadFilenamePart(sourceName, "sprite-preview");
  const safePreviewId = sanitizeDownloadFilenamePart(state.processPreview?.preview_id || localTimestamp(), localTimestamp());
  return `${safeSourceName}-preview-${safePreviewId}.png`;
}

function stripFileExtension(name) {
  return String(name || "").replace(/\.[^./\\]+$/, "");
}

function sanitizeDownloadFilenamePart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[.\- ]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function localTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function triggerFileDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function updateSavePreviewButton() {
  if (!els.savePreviewButton || !els.greenToBlackButton || !els.greenDesaturateButton || !els.semiTransparentToBlackButton || !els.semiTransparentToOpaqueButton) {
    return;
  }

  const isSameUpload = !state.processPreview?.upload_id || state.processPreview.upload_id === state.upload?.upload_id;
  const canDownload = Boolean(state.upload && isSameUpload && state.processPreview?.preview_id && state.processPreview?.processed_url);
  const canPostprocess = Boolean(state.upload && isSameUpload && state.processPreview?.preview_id);
  els.greenToBlackButton.hidden = !state.upload;
  els.greenToBlackButton.disabled = !canPostprocess;
  els.greenDesaturateButton.hidden = !state.upload;
  els.greenDesaturateButton.disabled = !canPostprocess;
  els.semiTransparentToBlackButton.hidden = !state.upload;
  els.semiTransparentToBlackButton.disabled = !canPostprocess;
  els.semiTransparentToOpaqueButton.hidden = !state.upload;
  els.semiTransparentToOpaqueButton.disabled = !canPostprocess;
  els.savePreviewButton.hidden = !state.upload;
  els.savePreviewButton.disabled = !canDownload;
}

function renderJob() {
  if (!state.job) {
    showAnimationWorkbench();
    return;
  }

  const options = state.job.options || {};
  const keyColor = options.key_color || "#000000";
  const matte = options.matte || { mode: options.matte_mode || (options.chroma_enabled ? "chroma" : "none") };
  const matteDetail = formatMatteDetail(matte);
  const sourceMediaType = state.job.source_media_type || uploadMediaType();
  const outputWidth = options.output_width || options.target_size || "-";
  const outputHeight = options.output_height || options.target_size || "-";
  const sourceHeight = Number(state.job.video_info?.height || 0);
  const legacyOutputScale = sourceHeight && options.target_size ? Number(options.target_size) / sourceHeight : 0;
  const outputScaleLabel = formatOutputScaleLabel(options.output_scale || legacyOutputScale);
  const isCustomAnimation = sourceMediaType === "animation";
  const isImageSequence = sourceMediaType === "image_sequence";
  const segmentLabel = isCustomAnimation
    ? "\u81EA\u5B9A\u4E49\u52A8\u753B\u5E27\u5E8F\u5217"
    : isImageSequence
    ? `\u56FE\u7247\u5E8F\u5217\uFF1A\u7B2C ${options.start_frame || 1} - ${options.end_frame || state.job.frame_count} \u5E27`
    : sourceMediaType === "image"
    ? "\u5355\u5F20\u56FE\u7247\u8F93\u5165"
    : `${formatSeconds(options.start_time || 0)} - ${formatSeconds(options.end_time || 0)}`;
  els.resultPanel.hidden = false;
  els.exportResult.hidden = true;
  const summaryCards = [
    summaryCard("\u4efb\u52a1 ID", escapeHtml(state.job.job_id)),
    summaryCard("\u8f93\u51fa\u5e27\u6570", `${state.job.frame_count} \u5e27`),
    summaryCard("\u53D6\u6837\u65B9\u5F0F", escapeHtml(formatSourceModeLabel(state.job.ffmpeg_accel, sourceMediaType))),
    summaryCard("\u62A0\u56FE\u6A21\u5F0F", escapeHtml(`${formatMatteModeLabel(matte)}${matteDetail ? ` / ${matteDetail}` : ""}`)),
    summaryCard("\u8F93\u51FA\u500D\u6570", escapeHtml(outputScaleLabel)),
    summaryCard("\u8F93\u51FA\u753B\u5E03", `${outputWidth} \u00d7 ${outputHeight}`),
    summaryCard("\u753B\u5E03\u5E03\u5C40", escapeHtml(formatCanvasModeLabel(options.canvas_mode))),
    summaryCard("\u62BD\u5E27\u95F4\u9694", isCustomAnimation || isImageSequence ? "\u6309\u6587\u4EF6\u540D\u987A\u5E8F" : sourceMediaType === "image" ? "\u5355\u5F20\u56FE\u7247" : `\u6BCF ${options.keep_every || 1} \u5E27\u4FDD\u7559\u4E00\u5F20`),
    summaryCard("\u8F93\u5165\u533A\u95F4", segmentLabel),
  ];
  if (matte.mode === "chroma") {
    summaryCards.push(`
      <div class="summary-card">
        <span class="meta-label">\u8bc6\u522b\u5230\u7684\u80cc\u666f\u8272</span>
        <strong class="swatch-row">
          <span class="swatch" style="background:${keyColor}"></span>
          <span>${escapeHtml(keyColor)}</span>
        </strong>
      </div>
    `);
  }
  els.jobSummary.innerHTML = summaryCards.join("");
  renderFrames();
  syncResultActions();
  persistSession();
}

function renderFrames() {
  if (!state.job) {
    els.frameGrid.innerHTML = "";
    renderSelectionCount();
    syncAnimationPreview();
    return;
  }

  const orderMap = state.orderedSelectionMode ? getSelectionOrderMap() : new Map();
  els.frameGrid.innerHTML = state.job.frames
    .map((frame) => {
      const checked = state.selected.has(frame.index);
      const frameNumber = String(frame.index + 1).padStart(3, "0");
      const orderNumber = orderMap.get(frame.index);
      return `
        <label class="frame-card ${checked ? "selected" : ""}" data-index="${frame.index}">
          <div class="frame-check ${orderNumber ? "ordered" : ""}">
            <input type="checkbox" data-index="${frame.index}" ${checked ? "checked" : ""}>
            ${orderNumber ? `<span class="frame-order-number">${orderNumber}</span>` : ""}
          </div>
          <img src="${frame.thumb_url}" alt="frame ${frameNumber}">
          <div class="frame-meta">
            <span>#${frameNumber}</span>
            <span>${escapeHtml(frame.original_name || frame.name)}</span>
          </div>
        </label>
      `;
    })
    .join("");
  renderSelectionCount();
  syncAnimationPreview();
  syncResultActions();
  persistSession();
}

function renderSelectionCount() {
  const total = state.job?.frame_count || 0;
  els.selectionCount.textContent = `\u5df2\u9009 ${state.selected.size} / ${total} \u5e27`;
  syncResultActions();
}

function refreshCardSelection(index, checked) {
  const card = els.frameGrid.querySelector(`.frame-card[data-index="${index}"]`);
  if (card) {
    card.classList.toggle("selected", checked);
  }
}

function setOrderedSelectionMode(enabled) {
  state.orderedSelectionMode = Boolean(enabled);
  if (els.orderedSelectionInput) {
    els.orderedSelectionInput.checked = state.orderedSelectionMode;
  }
}

function setFrameSelected(index, checked) {
  if (!state.job) {
    return;
  }
  if (checked) {
    state.selected.add(index);
    state.selectionOrder = state.selectionOrder.filter((item) => item !== index);
    state.selectionOrder.push(index);
  } else {
    state.selected.delete(index);
    state.selectionOrder = state.selectionOrder.filter((item) => item !== index);
  }
  normalizeSelectionOrder();
}

function normalizeSelectionOrder() {
  if (!state.job) {
    state.selectionOrder = [];
    return state.selectionOrder;
  }

  const available = new Set(state.job.frames.map((frame) => frame.index));
  const validSelection = new Set();
  state.selected.forEach((index) => {
    if (available.has(index)) {
      validSelection.add(index);
    }
  });
  state.selected = validSelection;

  const seen = new Set();
  const ordered = [];
  state.selectionOrder.forEach((index) => {
    if (validSelection.has(index) && !seen.has(index)) {
      ordered.push(index);
      seen.add(index);
    }
  });
  state.job.frames.forEach((frame) => {
    if (validSelection.has(frame.index) && !seen.has(frame.index)) {
      ordered.push(frame.index);
      seen.add(frame.index);
    }
  });
  state.selectionOrder = ordered;
  return state.selectionOrder;
}

function getSelectionOrderMap() {
  return new Map(normalizeSelectionOrder().map((index, order) => [index, order + 1]));
}

function selectFrames(predicate) {
  if (!state.job) return;
  state.selected = new Set(state.job.frames.filter(predicate).map((frame) => frame.index));
  state.selectionOrder = state.job.frames.filter((frame) => state.selected.has(frame.index)).map((frame) => frame.index);
  state.preview.currentIndex = 0;
  clearMagicPreview();
  renderFrames();
}

function getSelectedFrames() {
  if (!state.job) {
    return [];
  }
  const frameMap = new Map(state.job.frames.map((frame) => [frame.index, frame]));
  const frames = state.orderedSelectionMode
    ? normalizeSelectionOrder()
        .map((index) => frameMap.get(index))
        .filter(Boolean)
    : state.job.frames.filter((frame) => state.selected.has(frame.index));
  return state.preview.isReversed ? frames.reverse() : frames;
}

function getSegmentFrameRate(upload = state.upload) {
  const fps = Number(currentUploadInfo(upload).fps || 0);
  return Number.isFinite(fps) && fps > 0 ? fps : 0;
}

function getSegmentFrameStep(upload = state.upload) {
  const fps = getSegmentFrameRate(upload);
  return fps > 0 ? 1 / fps : 0.01;
}

function getSegmentFrameCount(upload = state.upload) {
  if (isImageUpload(upload)) {
    return 1;
  }
  if (isImageSequenceUpload(upload)) {
    return Math.max(1, Math.round(Number(currentUploadInfo(upload).frame_count || 1)));
  }

  const fps = getSegmentFrameRate(upload);
  const duration = Math.max(Number(currentUploadInfo(upload).duration || 0), 0);
  if (fps <= 0 || duration <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(duration * fps));
}

function clampSegmentFrame(frame, upload = state.upload) {
  return clamp(Math.round(Number(frame || 1)), 1, getSegmentFrameCount(upload));
}

function syncSegmentFramesFromTimes(upload = state.upload) {
  if (isImageUpload(upload)) {
    state.segment.startFrame = 1;
    state.segment.endFrame = 1;
    return;
  }
  if (isImageSequenceUpload(upload)) {
    state.segment.startFrame = clampSegmentFrame(state.segment.startFrame, upload);
    state.segment.endFrame = clampSegmentFrame(state.segment.endFrame, upload);
    return;
  }

  state.segment.startFrame = timeToSegmentFrame(state.segment.start, "start", upload);
  state.segment.endFrame = timeToSegmentFrame(state.segment.end, "end", upload);
}

function syncSegmentTimesFromFrames(upload = state.upload) {
  if (isImageUpload(upload)) {
    state.segment.start = 0;
    state.segment.end = 0;
    state.segment.startFrame = 1;
    state.segment.endFrame = 1;
    return;
  }
  if (isImageSequenceUpload(upload)) {
    state.segment.start = 0;
    state.segment.end = 0;
    state.segment.startFrame = clampSegmentFrame(state.segment.startFrame, upload);
    state.segment.endFrame = clampSegmentFrame(state.segment.endFrame, upload);
    return;
  }

  state.segment.startFrame = clampSegmentFrame(state.segment.startFrame, upload);
  state.segment.endFrame = clampSegmentFrame(state.segment.endFrame, upload);
  state.segment.start = segmentFrameToTime(state.segment.startFrame, "start", upload);
  state.segment.end = segmentFrameToTime(state.segment.endFrame, "end", upload);
}

function timeToSegmentFrame(value, key, upload = state.upload) {
  if (isImageUpload(upload)) {
    return 1;
  }
  if (isImageSequenceUpload(upload)) {
    return clampSegmentFrame(key === "start" ? state.segment.startFrame : state.segment.endFrame, upload);
  }

  const step = getSegmentFrameStep(upload);
  const snapped = snapSegmentTime(value, key === "start" ? "floor" : "ceil", upload);
  const rawFrame = key === "start" ? Math.round(snapped / step) + 1 : Math.round(snapped / step);
  return clampSegmentFrame(rawFrame, upload);
}

function segmentFrameToTime(frame, key, upload = state.upload) {
  if (isImageUpload(upload)) {
    return 0;
  }
  if (isImageSequenceUpload(upload)) {
    return 0;
  }

  const clampedFrame = clampSegmentFrame(frame, upload);
  const step = getSegmentFrameStep(upload);
  const rawTime = key === "start" ? (clampedFrame - 1) * step : clampedFrame * step;
  return snapSegmentTime(rawTime, key === "start" ? "floor" : "ceil", upload);
}

function getSegmentFrameValue(key, upload = state.upload) {
  if (isImageSequenceUpload(upload)) {
    return clampSegmentFrame(key === "start" ? state.segment.startFrame : state.segment.endFrame, upload);
  }
  return timeToSegmentFrame(key === "start" ? state.segment.start : state.segment.end, key, upload);
}

function getSelectedSegmentFrameCount(upload = state.upload) {
  if (isImageUpload(upload)) {
    return 1;
  }
  if (isImageSequenceUpload(upload)) {
    const startFrame = clampSegmentFrame(state.segment.startFrame, upload);
    const endFrame = clampSegmentFrame(state.segment.endFrame, upload);
    return Math.max(1, endFrame - startFrame + 1);
  }
  const startFrame = getSegmentFrameValue("start", upload);
  const endFrame = getSegmentFrameValue("end", upload);
  return Math.max(1, endFrame - startFrame + 1);
}

function formatSegmentStep(upload = state.upload) {
  return getSegmentFrameStep(upload).toFixed(8).replace(/0+$/u, "").replace(/\.$/u, "");
}

function snapSegmentTime(value, mode = "round", upload = state.upload) {
  if (isImageUpload(upload) || isImageSequenceUpload(upload)) {
    return 0;
  }

  const duration = Math.max(Number(currentUploadInfo(upload).duration || 0), 0);
  const step = Math.max(getSegmentFrameStep(upload), 1e-6);
  const clampedValue = clamp(Number(value || 0), 0, duration);
  const framePosition = clampedValue / step;

  let frameIndex = Math.round(framePosition);
  if (mode === "floor") {
    frameIndex = Math.floor(framePosition + 1e-9);
  } else if (mode === "ceil") {
    frameIndex = Math.ceil(framePosition - 1e-9);
  }

  const snapped = clamp(frameIndex * step, 0, duration);
  return Number(snapped.toFixed(8));
}

function normalizePreviewInterval() {
  const value = Number(els.previewIntervalInput.value || 100);
  const normalized = clamp(Math.round(value), 20, 5000);
  els.previewIntervalInput.value = String(normalized);
  return normalized;
}

function normalizeHexColor(value, fallback = "#F6FBF6") {
  const raw = String(value || "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(raw)) {
    return raw;
  }
  return fallback;
}

function normalizeProcessPreviewBackgroundMode(value) {
  return value === "color" ? "color" : "checkerboard";
}

function updateProcessPreviewBackground(mode, color, shouldPersist = false) {
  const normalizedMode = normalizeProcessPreviewBackgroundMode(mode);
  const normalizedColor = normalizeHexColor(color, state.processPreviewBackground.color);
  state.processPreviewBackground.mode = normalizedMode;
  state.processPreviewBackground.color = normalizedColor;

  els.processPreviewBackgroundModeInput.value = normalizedMode;
  els.processPreviewBackgroundInput.value = normalizedColor;
  els.processPreviewBackgroundLabel.textContent = normalizedColor;
  els.processPreviewBackgroundColorRow.hidden = normalizedMode !== "color";

  if (els.previewProcessedStage) {
    els.previewProcessedStage.style.setProperty("--process-preview-bg-color", normalizedColor);
    els.previewProcessedStage.classList.toggle("checkerboard-stage", normalizedMode === "checkerboard");
    els.previewProcessedStage.classList.toggle("solid-preview-stage", normalizedMode === "color");
  }

  if (shouldPersist) {
    persistSession();
  }
}

function setPreviewStageBackground(color) {
  const normalized = normalizeHexColor(color, state.preview.background);
  [
    els.animationPreviewCanvas,
    ...MAGIC_VARIANT_CONFIGS.map((config) => els[config.canvasId]),
  ].forEach((canvas) => {
    const stage = canvas?.closest(".animation-stage");
    if (!stage) {
      return;
    }
    stage.style.setProperty("--preview-bg-color", normalized);
  });
}

function updatePreviewBackground(color, shouldPersist = false) {
  const normalized = normalizeHexColor(color);
  state.preview.background = normalized;
  els.previewBackgroundInput.value = normalized;
  els.previewBackgroundLabel.textContent = normalized;
  setPreviewStageBackground(normalized);
  if (shouldPersist) {
    persistSession();
  }
}

function resetPreviewState() {
  stopPreviewTimer();
  state.preview.currentIndex = 0;
  state.preview.isPlaying = true;
  state.preview.renderToken += 1;
  state.preview.imageCache.clear();
}

function stopPreviewTimer() {
  state.preview.warmupToken += 1;
  if (state.preview.rafId !== null) {
    window.cancelAnimationFrame(state.preview.rafId);
    state.preview.rafId = null;
  }
}

function restartPreviewTimer() {
  stopPreviewTimer();
  const selectedFrames = getSelectedFrames();
  if (!state.preview.isPlaying || selectedFrames.length <= 1) {
    updatePreviewControls(selectedFrames.length);
    return;
  }

  const warmupToken = state.preview.warmupToken;
  const startLoop = () => {
    if (warmupToken !== state.preview.warmupToken || !state.preview.isPlaying) {
      return;
    }

    let lastAdvanceAt = performance.now();
    const tick = (now) => {
      if (warmupToken !== state.preview.warmupToken) {
        return;
      }

      const frames = getSelectedFrames();
      const frameCount = frames.length;
      if (!state.preview.isPlaying || frameCount <= 1) {
        stopPreviewTimer();
        updatePreviewControls(frameCount);
        return;
      }

      if (state.preview.currentIndex >= frameCount) {
        state.preview.currentIndex = 0;
        drawPreviewFrameFromCache(frames[0], frameCount);
      }

      const intervalMs = normalizePreviewInterval();
      const elapsed = now - lastAdvanceAt;
      if (elapsed >= intervalMs) {
        const steps = Math.max(1, Math.floor(elapsed / intervalMs));
        lastAdvanceAt += steps * intervalMs;
        state.preview.currentIndex = (state.preview.currentIndex + steps) % frameCount;
        drawPreviewFrameFromCache(frames[state.preview.currentIndex], frameCount);
      }

      state.preview.rafId = window.requestAnimationFrame(tick);
    };

    state.preview.rafId = window.requestAnimationFrame(tick);
  };

  if (selectedFrames.every((frame) => getCachedPreviewImage(frame.url))) {
    startLoop();
    updatePreviewControls(selectedFrames.length);
    return;
  }

  warmPreviewFrames(selectedFrames)
    .then(() => {
      startLoop();
    })
    .catch((error) => {
      if (warmupToken !== state.preview.warmupToken) {
        return;
      }
      setStatus(error.message || String(error), "error");
    });
  updatePreviewControls(selectedFrames.length);
}

function togglePreviewPlayback() {
  const selectedFrames = getSelectedFrames();
  if (selectedFrames.length === 0) {
    return;
  }
  state.preview.isPlaying = !state.preview.isPlaying;
  if (state.preview.isPlaying) {
    restartPreviewTimer();
  } else {
    stopPreviewTimer();
    updatePreviewControls(selectedFrames.length);
  }
  persistSession();
}

function restartPreviewPlayback() {
  state.preview.currentIndex = 0;
  syncAnimationPreview();
  persistSession();
}

function updatePreviewControls(selectedCount) {
  const hasFrames = selectedCount > 0;
  const canAnimate = selectedCount > 1;
  const currentIndex = hasFrames ? Math.min(state.preview.currentIndex, selectedCount - 1) : 0;
  const progressPercent = hasFrames ? ((currentIndex + 1) / selectedCount) * 100 : 0;
  els.previewPlayPauseButton.disabled = !canAnimate;
  els.previewRestartButton.disabled = !hasFrames;
  els.previewReverseInput.disabled = !hasFrames;
  els.previewProgressFill.style.width = `${progressPercent}%`;
  els.previewProgressLabel.textContent = hasFrames
    ? `${currentIndex + 1} / ${selectedCount}`
    : "0 / 0";
  els.previewPlayPauseButton.textContent = canAnimate
    ? (state.preview.isPlaying ? "\u6682\u505c\u9884\u89c8" : "\u64ad\u653e\u9884\u89c8")
    : "\u5355\u5E27\u9884\u89C8";
  els.previewSelectedCount.textContent = `\u5df2\u52a0\u8f7d ${selectedCount} \u5e27`;
}

async function loadPreviewImage(url) {
  const cached = state.preview.imageCache.get(url);
  if (cached) {
    return cached instanceof HTMLImageElement ? Promise.resolve(cached) : cached;
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      state.preview.imageCache.set(url, image);
      resolve(image);
    };
    image.onerror = () => {
      state.preview.imageCache.delete(url);
      reject(new Error(`\u9884\u89c8\u5E27\u52A0\u8F7D\u5931\u8D25: ${url}`));
    };
    image.src = url;
  });

  state.preview.imageCache.set(url, promise);
  return promise;
}

function getCachedPreviewImage(url) {
  const cached = state.preview.imageCache.get(url);
  return cached instanceof HTMLImageElement ? cached : null;
}

function warmPreviewFrames(frames) {
  return Promise.all(frames.map((frame) => loadPreviewImage(frame.url)));
}

function paintFrameOnCanvas(canvas, image) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.preview.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const baseScale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const scale = baseScale;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = Math.round((canvas.width - drawWidth) / 2);
  const drawY = Math.round((canvas.height - drawHeight) / 2);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawPreviewPlaceholder() {
  const canvas = els.animationPreviewCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.preview.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  els.previewEmptyState.hidden = false;
  els.previewFrameLabel.textContent = "\u5F53\u524D -";
  if (state.magicPreview) {
    drawMagicPlaceholder();
  }
}

function renderPreviewFrameImage(image, frame, selectedCount) {
  const canvas = els.animationPreviewCanvas;
  paintFrameOnCanvas(canvas, image);
  els.previewEmptyState.hidden = true;
  els.previewFrameLabel.textContent = `\u5F53\u524D #${String(frame.index + 1).padStart(3, "0")}`;
  updatePreviewControls(selectedCount);
  syncMagicPreviewFrame(frame, selectedCount, state.preview.currentIndex);
}

function magicVariantElements(config) {
  return {
    panel: els[config.panelId],
    canvas: els[config.canvasId],
    empty: els[config.emptyId],
    frameLabel: els[config.frameLabelId],
    count: els[config.countId],
    progressFill: els[config.progressFillId],
    progressLabel: els[config.progressLabelId],
    sizeLabel: els[config.sizeLabelId],
    exportButton: els[config.exportButtonId],
  };
}

function magicVariantData(key) {
  if (!state.magicPreview) {
    return null;
  }
  if (state.magicPreview.variants?.[key]) {
    return state.magicPreview.variants[key];
  }
  return key === "half" ? state.magicPreview : null;
}

function drawMagicVariantPlaceholder(config, message = "\u7B49\u5F85 MAGIC") {
  const ui = magicVariantElements(config);
  if (!ui.canvas) {
    return;
  }
  const variant = magicVariantData(config.key);
  const canvas = ui.canvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.preview.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ui.empty.textContent = message;
  ui.empty.hidden = false;
  ui.frameLabel.textContent = `${config.label} -`;
  ui.count.textContent = variant
    ? `\u5DF2\u751F\u6210 ${variant.frame_count || 0} \u5E27`
    : "\u5DF2\u751F\u6210 0 \u5E27";
  ui.progressFill.style.width = "0%";
  ui.progressLabel.textContent = "0 / 0";
  ui.sizeLabel.textContent = formatMagicOutputSize(variant);
  ui.exportButton.disabled = !variant?.frames?.length;
}

function drawMagicPlaceholder(message = "\u7B49\u5F85 MAGIC") {
  MAGIC_VARIANT_CONFIGS.forEach((config) => drawMagicVariantPlaceholder(config, message));
}

function updateMagicVariantControls(config, selectedCount) {
  const ui = magicVariantElements(config);
  const variant = magicVariantData(config.key);
  const hasFrames = selectedCount > 0;
  const currentIndex = hasFrames ? Math.min(state.preview.currentIndex, selectedCount - 1) : 0;
  const progressPercent = hasFrames ? ((currentIndex + 1) / selectedCount) * 100 : 0;
  ui.progressFill.style.width = `${progressPercent}%`;
  ui.progressLabel.textContent = hasFrames
    ? `${currentIndex + 1} / ${selectedCount}`
    : "0 / 0";
  ui.count.textContent = `\u5DF2\u751F\u6210 ${variant?.frame_count || 0} \u5E27`;
  ui.sizeLabel.textContent = formatMagicOutputSize(variant);
  ui.exportButton.disabled = !variant?.frames?.length;
}

function updateMagicPreviewControls(selectedCount) {
  MAGIC_VARIANT_CONFIGS.forEach((config) => updateMagicVariantControls(config, selectedCount));
}

function formatMagicOutputSize(magicPreview) {
  const width = Number(magicPreview?.max_width || magicPreview?.frames?.[0]?.width || 0);
  const height = Number(magicPreview?.max_height || magicPreview?.frames?.[0]?.height || 0);
  return width > 0 && height > 0 ? `${width} \u00d7 ${height}` : "-";
}

function magicFrameForSelectedFrame(sourceFrame, selectedPosition, variantKey = "half") {
  const variant = magicVariantData(variantKey);
  if (!variant?.frames || !sourceFrame) {
    return null;
  }
  const magicFrame = variant.frames.find((frame) => Number(frame.index) === Number(selectedPosition)) || null;
  if (!magicFrame || Number(magicFrame.source_index) !== Number(sourceFrame.index)) {
    return null;
  }
  return magicFrame;
}

function renderMagicPreviewFrameImage(config, image, magicFrame, selectedCount) {
  const ui = magicVariantElements(config);
  paintFrameOnCanvas(ui.canvas, image);
  ui.empty.hidden = true;
  ui.frameLabel.textContent = `${config.label} #${String(Number(magicFrame.index || 0) + 1).padStart(3, "0")}`;
  updateMagicVariantControls(config, selectedCount);
}

async function syncMagicVariantPreviewFrame(config, sourceFrame, selectedCount, selectedPosition) {
  const ui = magicVariantElements(config);
  const variant = magicVariantData(config.key);
  if (!variant?.frames?.length || !ui.panel || ui.panel.hidden) {
    return;
  }

  const magicFrame = magicFrameForSelectedFrame(sourceFrame, selectedPosition, config.key);
  if (!magicFrame) {
    drawMagicVariantPlaceholder(config, "\u8FD9\u4E00\u5E27\u9700\u8981\u91CD\u65B0 MAGIC");
    updateMagicVariantControls(config, selectedCount);
    return;
  }

  state.magicPreview.renderTokens = state.magicPreview.renderTokens || {};
  const token = Number(state.magicPreview.renderTokens[config.key] || 0) + 1;
  state.magicPreview.renderTokens[config.key] = token;
  const cached = getCachedPreviewImage(magicFrame.url);
  if (cached) {
    renderMagicPreviewFrameImage(config, cached, magicFrame, selectedCount);
    return;
  }

  try {
    const image = await loadPreviewImage(magicFrame.url);
    if (token !== state.magicPreview?.renderTokens?.[config.key]) {
      return;
    }
    renderMagicPreviewFrameImage(config, image, magicFrame, selectedCount);
  } catch (error) {
    drawMagicVariantPlaceholder(config, "\u52A0\u8F7D MAGIC \u5931\u8D25");
    setStatus(error.message || String(error), "error");
  }
}

function syncMagicPreviewFrame(sourceFrame, selectedCount, selectedPosition) {
  MAGIC_VARIANT_CONFIGS.forEach((config) => {
    void syncMagicVariantPreviewFrame(config, sourceFrame, selectedCount, selectedPosition);
  });
}

function showMagicPreview() {
  if (!state.magicPreview?.frames?.length && !state.magicPreview?.variants?.half?.frames?.length) {
    clearMagicPreview();
    return;
  }
  MAGIC_VARIANT_CONFIGS.forEach((config) => {
    const ui = magicVariantElements(config);
    const variant = magicVariantData(config.key);
    ui.panel.hidden = !variant?.frames?.length;
    drawMagicVariantPlaceholder(config);
    updateMagicVariantControls(config, getSelectedFrames().length);
    if (variant?.frames?.length) {
      void warmPreviewFrames(variant.frames);
    }
  });
  syncAnimationPreview(false);
}

function clearMagicPreview() {
  state.magicPreview = null;
  MAGIC_VARIANT_CONFIGS.forEach((config) => {
    const ui = magicVariantElements(config);
    if (ui.panel) {
      ui.panel.hidden = true;
    }
  });
  drawMagicPlaceholder();
}

async function drawPreviewFrame(frame, selectedCount) {
  if (!frame) {
    drawPreviewPlaceholder();
    updatePreviewControls(selectedCount);
    return;
  }

  const token = ++state.preview.renderToken;
  try {
    const image = await loadPreviewImage(frame.url);
    if (token !== state.preview.renderToken) {
      return;
    }
    renderPreviewFrameImage(image, frame, selectedCount);
  } catch (error) {
    drawPreviewPlaceholder();
    setStatus(error.message || String(error), "error");
  }
}

function drawPreviewFrameFromCache(frame, selectedCount) {
  if (!frame) {
    drawPreviewPlaceholder();
    updatePreviewControls(selectedCount);
    return;
  }

  state.preview.renderToken += 1;
  const image = getCachedPreviewImage(frame.url);
  if (!image) {
    void drawPreviewFrame(frame, selectedCount);
    return;
  }

  renderPreviewFrameImage(image, frame, selectedCount);
}

function syncAnimationPreview(shouldRestartTimer = true) {
  const selectedFrames = getSelectedFrames();
  const selectedCount = selectedFrames.length;

  if (selectedCount === 0) {
    stopPreviewTimer();
    state.preview.currentIndex = 0;
    updatePreviewControls(0);
    drawPreviewPlaceholder();
    return;
  }

  if (state.preview.currentIndex >= selectedCount) {
    state.preview.currentIndex = 0;
  }

  const currentFrame = selectedFrames[state.preview.currentIndex];
  drawPreviewFrameFromCache(currentFrame, selectedCount);
  void warmPreviewFrames(selectedFrames);
  if (shouldRestartTimer) {
    restartPreviewTimer();
  }
}

async function runMagicPreview() {
  if (state.magicInFlight) {
    setStatus("MAGIC \u6B63\u5728\u5904\u7406\uFF0C\u5148\u7B49\u5F53\u524D\u8FD9\u8F6E\u7ED3\u675F\u3002");
    return;
  }
  if (!state.job) {
    setStatus("\u8FD8\u6CA1\u6709\u53EF\u4EE5 MAGIC \u7684\u5904\u7406\u7ED3\u679C\u3002", "error");
    return;
  }
  if (state.selected.size === 0) {
    setStatus("\u81F3\u5C11\u9009\u4E00\u5E27\u518D\u70B9 MAGIC\u3002", "error");
    syncResultActions();
    return;
  }

  state.magicInFlight = true;
  syncResultActions();
  try {
    await withBusy(els.magicButton, async () => {
      const selectedFrames = getSelectedFrames();
      const resizeMode = normalizeMagicResizeMode(state.magicResizeMode);
      const resizeModeLabel = magicResizeModeLabel(resizeMode);
      const useRealesrgan = Boolean(state.magicUseRealesrgan);
      const processLabel = useRealesrgan
        ? `Real-ESRGAN 超分后${resizeModeLabel}缩小`
        : `跳过 Real-ESRGAN，直接${resizeModeLabel}缩小`;
      clearMagicPreview();
      setStatus(`MAGIC \u6B63\u5728\u5904\u7406 ${selectedFrames.length} \u5E27\uFF1A${processLabel}\u5230 1/2\u30011/4\u30011/8...`);
      const data = await apiJson("/api/magic-preview", {
        method: "POST",
        body: {
          job_id: state.job.job_id,
          selected_indices: selectedFrames.map((frame) => frame.index),
          resize_mode: resizeMode,
          use_realesrgan: useRealesrgan,
        },
      });
      state.magicPreview = data.magic;
      showMagicPreview();
      const generatedCount = Number(data.magic.generated_count || 0);
      const reusedCount = Number(data.magic.reused_count || 0);
      const cacheLabel = reusedCount > 0
        ? generatedCount > 0
          ? `\uFF0C\u672C\u6B21\u65B0\u751F\u6210 ${generatedCount} \u5E27\uFF0C\u590D\u7528\u7F13\u5B58 ${reusedCount} \u5E27`
          : `\uFF0C\u672C\u6B21\u5168\u90E8\u590D\u7528\u7F13\u5B58\uFF0C\u6CA1\u6709\u91CD\u65B0\u751F\u6210`
        : "";
      const outputProcessLabel = data.magic.use_realesrgan === false
        ? `未使用 Real-ESRGAN，${data.magic.resize_mode_label || resizeModeLabel}缩小`
        : `Real-ESRGAN 超分后${data.magic.resize_mode_label || resizeModeLabel}缩小`;
      setStatus(`MAGIC \u5B8C\u6210\uFF0C${outputProcessLabel}\uFF0C\u5DF2\u751F\u6210 ${data.magic.frame_count} \u5E27 1/2\u30011/4\u30011/8 \u5C3A\u5BF8\u5BF9\u6BD4\u9884\u89C8${cacheLabel}\u3002`, "success");
    });
  } finally {
    state.magicInFlight = false;
    syncResultActions();
  }
}

async function exportMagicFrames(variantKey = "half", button = els.exportMagicFramesButton) {
  if (!state.magicPreview?.magic_id) {
    setStatus("\u5148\u70B9 MAGIC \u751F\u6210\u5904\u7406\u540E\u5E27\uFF0C\u518D\u5BFC\u51FA\u3002", "error");
    return;
  }
  const config = MAGIC_VARIANT_CONFIGS.find((item) => item.key === variantKey) || MAGIC_VARIANT_CONFIGS[0];
  const variant = magicVariantData(config.key);
  if (!variant?.frames?.length) {
    setStatus(`${config.label} \u8FD8\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u5E27\u3002`, "error");
    return;
  }

  await withBusy(button, async () => {
    setStatus(`\u6B63\u5728\u5BFC\u51FA ${config.label} \u5904\u7406\u540E\u5E27...`);
    const data = await apiJson("/api/export-magic-frames", {
      method: "POST",
      body: {
        magic_id: state.magicPreview.magic_id,
        variant_key: config.key,
        video_duration_ms: Number(els.previewIntervalInput.value || 100),
      },
    });
    state.exportResult = data.export;
    renderExportResult();
    const frameCount = Number(data.export?.frame_count || 0);
    const outputSize = formatMagicOutputSize(data.export);
    setStatus(`${config.label} \u5904\u7406\u540E\u5E27\u5DF2\u5BFC\u51FA\uFF1A${frameCount} \u5E27\uFF0C MOV \u786C\u8FB9\u7F18\u653E\u5927\u56DE ${outputSize}\uFF0C\u5DF2\u751F\u6210\u900F\u660E MOV\u3001GIF \u548C Sprite Sheet\u3002`, "success");
  });
}

function toggleExportOptions() {
  if (!state.job) {
    setStatus("\u8fd8\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u5904\u7406\u7ed3\u679c\u3002", "error");
    return;
  }
  if (state.selected.size === 0) {
    setStatus("\u81f3\u5c11\u9009\u4e00\u5e27\u518d\u5bfc\u51fa\u3002", "error");
    syncResultActions();
    return;
  }

  const shouldExpand = els.exportOptions.hidden;
  els.exportOptions.hidden = !shouldExpand;
  els.exportButton.setAttribute("aria-expanded", String(shouldExpand));
  els.exportButton.textContent = shouldExpand ? "\u6536\u8D77\u5BFC\u51FA\u9009\u9879" : "\u5BFC\u51FA\u9009\u4E2D\u5E27";
  if (shouldExpand) {
    setStatus("\u8BF7\u9009\u62E9\u8981\u751F\u6210\u7684\u5BFC\u51FA\u683C\u5F0F\u3002");
  }
}

async function exportSelectedFormat(exportFormat, button) {
  if (!state.job || state.selected.size === 0) {
    setStatus("\u81f3\u5c11\u9009\u4e00\u5e27\u518d\u5bfc\u51fa\u3002", "error");
    syncResultActions();
    return;
  }

  const labels = {
    frames: "Frames",
    sprite_sheet: "Spritesheet",
    mov: "\u900F\u660E MOV",
    gif: "GIF",
  };
  const label = labels[exportFormat] || exportFormat;
  await withBusy(button, async () => {
    const directionLabel = state.preview.isReversed ? "\u5012\u5E8F" : "";
    setStatus(`\u6B63\u5728${directionLabel}\u5BFC\u51FA ${label}...`);
    const selectedFrames = getSelectedFrames();
    const data = await apiJson("/api/export", {
      method: "POST",
      body: {
        job_id: state.job.job_id,
        selected_indices: selectedFrames.map((frame) => frame.index),
        video_duration_ms: Number(els.previewIntervalInput.value || 100),
        export_format: exportFormat,
      },
    });
    const outputFolder = exportFormat === "frames"
      ? data.export.frames_dir
      : exportFormat === "sprite_sheet"
      ? data.export.sheet_dir
      : data.export.output_dir;
    state.exportResult = null;
    renderExportResult();
    persistSession();
    const opened = await openPath(outputFolder);
    if (opened) {
      setStatus(`${label} \u5BFC\u51FA\u5B8C\u6210\uFF0C\u5DF2\u6253\u5F00\u6587\u4EF6\u5939\u3002`, "success");
    }
  });
}

function renderExportResult() {
  if (!state.exportResult || state.exportResult.frames_dir || state.exportResult.sheet_dir) {
    els.exportResult.hidden = true;
    els.exportResult.innerHTML = "";
    return;
  }

  els.exportResult.hidden = false;
  const fileLinks = [
    ["MOV", state.exportResult.mov_url || state.exportResult.video_url, state.exportResult.mov_name || state.exportResult.video_name],
    ["GIF", state.exportResult.gif_url, state.exportResult.gif_name],
  ]
    .filter(([, url]) => Boolean(url))
    .map(([label, url, name]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}: ${escapeHtml(name || url)}</a>`)
    .join("");
  const exportedContents = [
    state.exportResult.mov_url || state.exportResult.video_url ? "\u900F\u660E MOV" : "",
    state.exportResult.gif_url ? "GIF" : "",
  ]
    .filter(Boolean)
    .join(" / ");

  els.exportResult.innerHTML = `
    <div class="result-summary">
      ${summaryCard("\u5bfc\u51fa\u5e27\u6570", `${state.exportResult.frame_count} \u5e27`)}
      ${summaryCard("\u5bfc\u51fa\u5185\u5bb9", escapeHtml(exportedContents || "\u5DF2\u5BFC\u51FA"))}
    </div>
    <div class="link-list">
      ${fileLinks}
    </div>
  `;
  persistSession();
}

function summaryCard(label, value) {
  return `
    <div class="summary-card">
      <span class="meta-label">${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function formatFfmpegAccelLabel(ffmpegAccel) {
  if (!ffmpegAccel || typeof ffmpegAccel !== "object") {
    return "CPU";
  }

  const usedMode = String(ffmpegAccel.used_mode || "cpu").toLowerCase();
  const selectedMode = ffmpegAccel.selected_mode ? String(ffmpegAccel.selected_mode).toLowerCase() : "";
  const requestedMode = String(ffmpegAccel.requested_mode || "auto").toLowerCase();

  if (usedMode !== "cpu") {
    return `GPU (${usedMode})`;
  }
  if (ffmpegAccel.fallback_to_cpu && selectedMode) {
    return `CPU (${selectedMode} fallback)`;
  }
  if (requestedMode === "cpu") {
    return "CPU (manual)";
  }
  return "CPU";
}

function updateChromaVisibility() {
  const matteMode = currentMatteMode();
  const chromaEnabled = matteMode !== "none";
  const isChroma = chromaEnabled && matteModeUsesChromaSeed(matteMode);
  const isAi = chromaEnabled && matteModeUsesBiRefNet(matteMode);
  const isLuma = chromaEnabled && matteModeUsesLuma(matteMode);
  const isCorridor = chromaEnabled && matteModeUsesCorridorKey(matteMode);
  const usesSpillControls = chromaEnabled;
  const usesKeyColorControls = chromaEnabled && matteModeUsesChromaSeed(matteMode);
  const isManual = els.keyModeInput.value === "manual";
  els.corridorEnabledInput.checked = isCorridor;
  els.matteModeInput.disabled = !els.chromaEnabledInput.checked;
  els.keyModeInput.closest(".field").style.display = usesKeyColorControls ? "" : "none";
  els.manualColorField.style.display = usesKeyColorControls && isManual ? "" : "none";
  document.querySelectorAll(".matte-target-group").forEach((node) => {
    node.style.display = usesKeyColorControls || isLuma ? "" : "none";
  });
  document.querySelectorAll(".chroma-only").forEach((node) => {
    node.style.display = isChroma ? "" : "none";
  });
  document.querySelectorAll(".spill-matte-only").forEach((node) => {
    node.style.display = usesSpillControls ? "" : "none";
  });
  document.querySelectorAll(".ai-matte-only").forEach((node) => {
    node.style.display = isAi ? "" : "none";
  });
  document.querySelectorAll(".luma-matte-only").forEach((node) => {
    node.style.display = isLuma ? "" : "none";
  });
  document.querySelectorAll(".corridor-capable-only").forEach((node) => {
    node.style.display = "none";
  });
  document.querySelectorAll(".corridor-key-only").forEach((node) => {
    node.style.display = isCorridor ? "" : "none";
  });
}

function syncManualColorLabel() {
  els.manualKeyLabel.textContent = (els.manualKeyInput.value || "#00ff00").toUpperCase();
}

async function openPath(path) {
  try {
    await apiJson("/api/open-path", {
      method: "POST",
      body: { path },
    });
    return true;
  } catch (error) {
    setStatus(`\u6253\u5f00\u76ee\u5f55\u5931\u8d25\uff1a${error.message}`, "error");
    return false;
  }
}

async function apiJson(url, options = {}) {
  const fetchOptions = { ...options };
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    fetchOptions.headers = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    };
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    throw new Error(`\u8BF7\u6C42\u5931\u8D25\uFF1A${error.message || String(error)}\u3002\u8BF7\u786E\u8BA4 Sprite Video Lab \u540E\u7AEF\u6B63\u5728\u8FD0\u884C\uFF0C\u5E76\u5DF2\u91CD\u542F\u5230\u6700\u65B0\u7248\u672C\u3002`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`\u63A5\u53E3\u672A\u8FD4\u56DE JSON\uFF08HTTP ${response.status}\uFF09\u3002\u8BF7\u91CD\u542F Sprite Video Lab \u540E\u7AEF\u540E\u518D\u8BD5\u3002${detail ? ` ${detail}` : ""}`);
  }

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function withBusy(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    button.disabled = false;
  }
}

function setStatus(message, tone = "") {
  els.appStatus.textContent = message;
  els.appStatus.className = `status-message${tone ? ` ${tone}` : ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSeconds(value) {
  return `${Number(value || 0).toFixed(2)}s`;
}
