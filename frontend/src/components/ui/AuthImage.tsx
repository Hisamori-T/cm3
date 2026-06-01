/**
 * 認証ヘッダー付きで画像を fetch して blob URL として表示するコンポーネント。
 * <img src={url}> は Authorization ヘッダーを送れないため、
 * fetch → blob → createObjectURL のパターンをカプセル化する。
 *
 * 使用箇所: progress/page.tsx, photo-album/page.tsx で重複していた処理を一元管理。
 */

"use client";

import React, { useEffect, useRef, useState } from "react";

interface AuthImageProps {
  /** 画像の API URL（例: /api/v1/progress/attachments/{id}）*/
  src: string;
  /** img の alt テキスト */
  alt?: string;
  /** img タグに適用するインラインスタイル */
  style?: React.CSSProperties;
  /** img タグに適用する className */
  className?: string;
  /** ローディング中に表示するプレースホルダー（省略時は何も表示しない）*/
  placeholder?: React.ReactNode;
  /** クリック時のコールバック */
  onClick?: () => void;
}

export function AuthImage({
  src,
  alt = "",
  style,
  className,
  placeholder,
  onClick,
}: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("cmv3_access_token")
        : null;

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        // 前回の blob URL を解放してメモリリークを防ぐ
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // コンポーネントアンマウント時に blob URL を解放
  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    };
  }, []);

  if (loading) {
    return placeholder ? <>{placeholder}</> : null;
  }

  if (error || !blobUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--c-surface-2)",
          color: "var(--c-text-muted)",
          fontSize: "var(--fs-xs, 11px)",
          ...style,
        }}
        className={className}
      >
        画像を読み込めませんでした
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={alt}
      style={style}
      className={className}
      onClick={onClick}
    />
  );
}
