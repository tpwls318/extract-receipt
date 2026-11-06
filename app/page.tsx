"use client";

import { useState } from "react";

interface ExtractedItem {
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert(data.error || "추출 실패");
      }
    } catch {
      alert("요청 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSheet = async () => {
    if (!result) return;
    setSaving(true);

    try {
      const res = await fetch("/api/save-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (data.success) {
        alert("구글 스프레드시트에 성공적으로 저장되었습니다!");
      } else {
        alert(`저장 실패: ${data.error}`);
      }
    } catch {
      alert("시트 전송 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 8px 0" }}>영수증 데이터 자동 추출 & 시트 연동</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>Gemini가 이미지를 분석해 정형 데이터로 변환 후 구글 시트에 자동 기록합니다.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* 업로드 박스 */}
        <div style={{ border: "2px dashed #ddd", borderRadius: "8px", padding: "24px", textAlign: "center", background: "#fafafa" }}>
          {preview ? (
            <img src={preview} alt="미리보기" style={{ maxHeight: "240px", maxWidth: "100%", objectFit: "contain", marginBottom: "16px" }} />
          ) : (
            <div style={{ padding: "40px 0", color: "#999", fontSize: "14px" }}>영수증 이미지 선택</div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "block", margin: "0 auto 16px auto", fontSize: "13px" }} />
          <button
            onClick={handleExtract}
            disabled={!file || loading}
            style={{
              width: "100%",
              padding: "10px",
              background: file && !loading ? "#000" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: file && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "AI 추출 진행 중..." : "AI 추출 실행"}
          </button>
        </div>

        {/* 결과 박스 */}
        <div style={{ border: "1px solid #eee", borderRadius: "8px", padding: "24px", background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "bold", marginTop: 0, marginBottom: "16px" }}>추출 결과</h2>
          {result ? (
            <div style={{ fontSize: "14px" }}>
              <div style={{ paddingBottom: "12px", borderBottom: "1px solid #eee", marginBottom: "12px", lineHeight: "1.8" }}>
                <div><strong>가맹점:</strong> {result.merchantName}</div>
                <div><strong>결제일자:</strong> {result.date}</div>
                <div><strong>총 금액:</strong> <span style={{ color: "#0066cc", fontWeight: "bold" }}>{result.totalAmount.toLocaleString()}원</span></div>
                {result.taxAmount ? <div><strong>부가세:</strong> {result.taxAmount.toLocaleString()}원</div> : null}
              </div>

              <div>
                <strong>품목 목록</strong>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0", fontSize: "13px" }}>
                  {result.items.map((item, idx) => (
                    <li key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dotted #eee" }}>
                      <span>{item.name} {item.count ? `(${item.count}개)` : ""}</span>
                      <span>{item.price.toLocaleString()}원</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 구글 시트 전송 버튼 */}
              <button
                onClick={handleSaveToSheet}
                disabled={saving}
                style={{
                  width: "100%",
                  marginTop: "20px",
                  padding: "10px",
                  background: saving ? "#aaa" : "#0f9d58",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "시트에 행 추가 중..." : "구글 스프레드시트로 전송"}
              </button>
            </div>
          ) : (
            <div style={{ color: "#aaa", textAlign: "center", padding: "40px 0", fontSize: "14px" }}>
              좌측에서 이미지를 넣고 AI 추출을 먼저 실행하세요.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}