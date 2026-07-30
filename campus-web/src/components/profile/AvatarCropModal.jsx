import { useCallback, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import imageCompression from "browser-image-compression";
import { FiX } from "react-icons/fi";

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = url;
  });

const getCroppedBlob = async (imageSrc, cropPixels) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.min(cropPixels.width, cropPixels.height);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to crop image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
};

const AvatarCropModal = ({ file, onCancel, onConfirm, busy = false }) => {
  const imageSrc = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) {
      return;
    }

    setProcessing(true);

    try {
      const croppedBlob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], "avatar.jpg", {
        type: "image/jpeg",
      });

      const compressed = await imageCompression(croppedFile, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const finalFile = new File([compressed], "avatar.jpg", {
        type: "image/jpeg",
      });

      await onConfirm(finalFile);
    } finally {
      setProcessing(false);
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    }
  };

  if (!file) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-semibold text-white">Crop profile photo</h3>
          <button
            type="button"
            onClick={() => {
              if (imageSrc) {
                URL.revokeObjectURL(imageSrc);
              }
              onCancel();
            }}
            className="rounded-lg p-2 text-[#b5bac1] hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-72 bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-4 p-4">
          <label className="block text-sm text-[#b5bac1]">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (imageSrc) {
                  URL.revokeObjectURL(imageSrc);
                }
                onCancel();
              }}
              disabled={busy || processing}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[#b5bac1] hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || processing}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
            >
              {busy || processing ? "Saving..." : "Save photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
