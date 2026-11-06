"use client";

import { useState, useEffect, useRef } from "react";

interface ExtractedItem {
  id: string;
  name: string;
  price: number;
  count?: number;
}

interface ExtractedData {
  merchantName: string;
  date: string;
  totalAmount: number;
  taxAmount: number;
  items: ExtractedItem[];
}

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Object URL 메모리 누수 방지
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setStatus({ type: "error", text: "이미지 파일만 업로드할 수 있습니다." });
      return;
    }
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setSaved(false);
    setStatus(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    setSaved(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const rawItems = Array.isArray(data.data.items) ? data.data.items : [];
        const extracted: ExtractedData = {
          merchantName: data.data.merchantName ?? "",
          date: data.data.date ?? "",
          totalAmount: Number(data.data.totalAmount ?? 0),
          taxAmount: Number(data.data.taxAmount ?? 0),
          items: rawItems.map((item: Partial<ExtractedItem>) => ({
            id: crypto.randomUUID(),
            name: item.name ?? "",
            price: Number(item.price ?? 0),
            count: item.count ?? 1,
          })),
        };
        setResult(extracted);
      } else {
        setStatus({ type: "error", text: data.error || "데이터 추출에 실패했습니다." });
      }
    } catch {
      setStatus({ type: "error", text: "추출 요청 중 네트워크 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSheet = async () => {
    if (!result || saving || saved) return;
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/save-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaved(true);
        setStatus({ type: "success", text: "구글 스프레드시트에 성공적으로 저장되었습니다!" });
      } else {
        setStatus({ type: "error", text: `저장 실패: ${data.error || "알 수 없는 오류"}` });
      }
    } catch {
      setStatus({ type: "error", text: "시트 전송 중 네트워크 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ExtractedData>(key: K, value: ExtractedData[K]) => {
    if (!result) return;
    setResult({ ...result, [key]: value });
    setSaved(false);
  };

  const updateItem = (index: number, patch: Partial<ExtractedItem>) => {
    if (!result) return;
    const nextItems = result.items.map((item, idx) =>
      idx === index ? { ...item, ...patch } : item
    );
    setResult({ ...result, items: nextItems });
    setSaved(false);
  };

  const removeItem = (index: number) => {
    if (!result) return;
    setResult({
      ...result,
      items: result.items.filter((_, idx) => idx !== index),
    });
    setSaved(false);
  };

  const addItem = () => {
    if (!result) return;
    setResult({
      ...result,
      items: [
        ...result.items,
        { id: crypto.randomUUID(), name: "", price: 0, count: 1 },
      ],
    });
    setSaved(false);
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 font-sans text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          영수증 데이터 자동 추출 & 시트 연동
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Gemini가 이미지를 분석해 정형 데이터로 변환하며, 검수 후 구글 시트에 자동 기록합니다.
        </p>
      </header>

      {status && (
        <div
          role="alert"
          className={`mb-6 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <span>{status.text}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="ml-4 text-xs font-medium underline opacity-75 hover:opacity-100"
          >
            닫기
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 업로드 박스 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col justify-between rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20"
              : "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/60"
          }`}
        >
          <div>
            {preview ? (
              <div className="mb-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="영수증 미리보기"
                  className="max-h-64 max-w-full rounded-lg object-contain shadow-sm"
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer py-12 text-sm text-neutral-500 dark:text-neutral-400"
              >
                <p className="font-medium text-neutral-700 dark:text-neutral-300">
                  클릭하거나 영수증 이미지를 이곳에 드래그하세요
                </p>
                <p className="mt-1 text-xs text-neutral-400">PNG, JPG, WEBP 지원</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mx-auto mb-4 block w-full max-w-xs text-xs text-neutral-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-800 hover:file:bg-neutral-300 dark:text-neutral-400 dark:file:bg-neutral-800 dark:file:text-neutral-200"
            />
          </div>

          <button
            type="button"
            onClick={handleExtract}
            disabled={!file || loading}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          >
            {loading ? "AI 추출 진행 중..." : "AI 추출 실행"}
          </button>
        </div>

        {/* 결과 및 검수 박스 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">추출 결과</h2>
            {result && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                클릭하여 값 수정 가능
              </span>
            )}
          </div>

          {result ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-2.5 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <label className="flex items-center justify-between gap-2">
                  <span className="w-20 shrink-0 font-semibold text-neutral-700 dark:text-neutral-300">
                    가맹점
                  </span>
                  <input
                    type="text"
                    value={result.merchantName}
                    onChange={(e) => updateField("merchantName", e.target.value)}
                    className="w-full rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="w-20 shrink-0 font-semibold text-neutral-700 dark:text-neutral-300">
                    결제일자
                  </span>
                  <input
                    type="date"
                    value={result.date}
                    onChange={(e) => updateField("date", e.target.value)}
                    className="w-full rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100 dark:[color-scheme:dark]"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="w-20 shrink-0 font-semibold text-neutral-700 dark:text-neutral-300">
                    총 금액(원)
                  </span>
                  <input
                    type="number"
                    value={result.totalAmount}
                    onChange={(e) => updateField("totalAmount", Number(e.target.value))}
                    className="w-full rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm font-bold text-blue-600 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-blue-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-2">
                  <span className="w-20 shrink-0 font-semibold text-neutral-700 dark:text-neutral-300">
                    부가세(원)
                  </span>
                  <input
                    type="number"
                    value={result.taxAmount}
                    onChange={(e) => updateField("taxAmount", Number(e.target.value))}
                    className="w-full rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <strong className="text-neutral-700 dark:text-neutral-300">품목 목록</strong>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    + 품목 추가
                  </button>
                </div>

                <ul className="space-y-2 text-xs">
                  {(result.items ?? []).map((item, idx) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-1.5 border-b border-dotted border-neutral-200 pb-2 dark:border-neutral-800"
                    >
                      <input
                        type="text"
                        placeholder="품목명"
                        value={item.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-neutral-200 bg-transparent px-2 py-1 text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
                      />
                      <input
                        type="number"
                        placeholder="수량"
                        min={1}
                        value={item.count ?? 1}
                        onChange={(e) => updateItem(idx, { count: Number(e.target.value) })}
                        className="w-14 rounded border border-neutral-200 bg-transparent px-1.5 py-1 text-center text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
                      />
                      <input
                        type="number"
                        placeholder="금액"
                        value={item.price}
                        onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                        className="w-24 rounded border border-neutral-200 bg-transparent px-2 py-1 text-right text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        aria-label="품목 삭제"
                        className="px-1 text-neutral-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 구글 시트 전송 버튼 */}
              <button
                type="button"
                onClick={handleSaveToSheet}
                disabled={saving || saved}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-neutral-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
              >
                {saving
                  ? "시트에 행 추가 중..."
                  : saved
                  ? "구글 스프레드시트 저장 완료 ✓"
                  : "구글 스프레드시트로 전송"}
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              좌측에서 이미지를 넣고 AI 추출을 먼저 실행하세요.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
