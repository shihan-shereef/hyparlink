"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useMutation, useQuery } from "convex/react";
import {
  FileImage,
  FileVideo,
  FileAudio,
  Type,
  Upload,
  Search,
  Trash2,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import { toast } from "sonner";

const TYPE_FILTERS = [
  { id: "all", label: "All Assets" },
  { id: "image", label: "Images", icon: FileImage },
  { id: "video", label: "Videos", icon: FileVideo },
  { id: "audio", label: "Audio", icon: FileAudio },
  { id: "font", label: "Fonts", icon: Type },
];

export default function AssetsPage() {
  const { current } = useWorkspace();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assets = useQuery(
    api.assets.list,
    current
      ? {
          workspaceId: current,
          type: selectedType === "all" ? undefined : selectedType,
          search: searchQuery.trim() || undefined,
        }
      : "skip",
  );

  const createAsset = useMutation(api.assets.create);
  const removeAsset = useMutation(api.assets.remove);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !current) return;

    // Detect asset type
    let assetType = "image";
    if (file.type.startsWith("video/")) assetType = "video";
    else if (file.type.startsWith("audio/")) assetType = "audio";
    else if (
      file.type.startsWith("font/") ||
      /\.(woff|woff2|ttf)$/i.test(file.name)
    )
      assetType = "font";

    // Validate size limit (20MB for images/fonts, 100MB audio, 500MB video)
    const maxMb =
      assetType === "video" ? 500 : assetType === "audio" ? 100 : 20;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File exceeds ${maxMb}MB limit for ${assetType}s`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64 || "");
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const data = await base64Promise;

      // Upload to backend service storage endpoint
      const backendBase =
        process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const uploadRes = await fetch(`${backendBase}/assets/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: current,
          name: file.name,
          originalFilename: file.name,
          type: assetType,
          mimeType: file.type || "application/octet-stream",
          data,
        }),
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Upload failed with status ${uploadRes.status}`,
        );
      }

      const uploadData = await uploadRes.json();

      // Persist Convex record
      await createAsset({
        workspaceId: current,
        name: file.name,
        originalFilename: file.name,
        type: assetType,
        mimeType: uploadData.mimeType,
        size: uploadData.size,
        storageProvider: uploadData.storageProvider || "local",
        storageKey: uploadData.storageKey,
        storageUrl: uploadData.storageUrl,
        cdnUrl: uploadData.cdnUrl,
      });

      toast.success(`${file.name} uploaded successfully!`, { id: toastId });
    } catch (err: any) {
      console.error("Asset upload failed", err);
      toast.error(err.message || "Asset upload failed", { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (assetId: Id<"assets">, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await removeAsset({ assetId });
      if (res?.storageKey) {
        const backendBase =
          process.env.NEXT_PUBLIC_BACKEND_URL || "";
        fetch(`${backendBase}/assets/${res.storageKey}`, {
          method: "DELETE",
        }).catch(() => {});
      }
      toast.success("Asset deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete asset");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-primary">
              Workspace Assets
            </h1>
            <p className="text-sm text-primary/60">
              Upload logos, videos, audio, and brand assets to power
              AI-generated compositions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,audio/*,.woff,.woff2,.ttf"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !current}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Upload Asset
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {TYPE_FILTERS.map((f) => {
              const active = selectedType === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedType(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-primary/70 hover:bg-card/80 border border-border"
                  }`}
                >
                  {f.icon && <f.icon className="h-3.5 w-3.5" />}
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary/40" />
            <Input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-card"
            />
          </div>
        </div>

        {/* Assets Grid */}
        {!assets || assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40 mb-4">
              <Upload className="h-7 w-7" />
            </span>
            <h3 className="text-base font-semibold text-primary">
              No assets found
            </h3>
            <p className="mt-1 text-sm text-primary/60 max-w-sm">
              Upload your logos, background videos, audio, or fonts to use them
              in video generation.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="mt-5 gap-2"
            >
              <Plus className="h-4 w-4" /> Upload First Asset
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {assets.map((asset: any) => {
              const url = asset.cdnUrl || asset.storageUrl;
              return (
                <div
                  key={asset._id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition"
                >
                  {/* Media Preview Box */}
                  <div className="relative aspect-video w-full bg-secondary/50 flex items-center justify-center overflow-hidden border-b border-border/60">
                    {asset.type === "image" ? (
                      // biome-ignore lint/a11y/useAltText: preview
                      <img
                        src={url}
                        alt={asset.name}
                        className="h-full w-full object-contain p-2"
                      />
                    ) : asset.type === "video" ? (
                      <video
                        src={url}
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : asset.type === "audio" ? (
                      <div className="p-4 w-full flex flex-col items-center gap-2">
                        <FileAudio className="h-8 w-8 text-primary/40" />
                        <audio src={url} controls className="w-full h-8" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-primary/50">
                        <Type className="h-8 w-8" />
                        <span className="text-[10px] font-mono uppercase tracking-wider">
                          Font File
                        </span>
                      </div>
                    )}

                    {/* Type Badge */}
                    <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                      {asset.type}
                    </span>
                  </div>

                  {/* Info Footer */}
                  <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                    <div>
                      <h4
                        className="truncate text-xs font-semibold text-primary"
                        title={asset.name}
                      >
                        {asset.name}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-primary/50">
                        {formatSize(asset.size)} •{" "}
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                      <Link
                        href={`/create-video?assetId=${asset._id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 hover:text-primary transition"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Use in Video
                      </Link>

                      <button
                        onClick={() => handleDelete(asset._id, asset.name)}
                        className="text-primary/40 hover:text-red-500 transition p-1"
                        title="Delete Asset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
