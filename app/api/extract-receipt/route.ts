import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchantName: { type: Type.STRING, description: "상호명 또는 가맹점명" },
    date: { type: Type.STRING, description: "결제 일자 (YYYY-MM-DD 포맷)" },
    totalAmount: { type: Type.NUMBER, description: "최종 결제 금액 (숫자만)" },
    taxAmount: { type: Type.NUMBER, description: "부가세 또는 세금 (확인 불가능 시 0)" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "품목명" },
          price: { type: Type.NUMBER, description: "단가 또는 금액" },
          count: { type: Type.NUMBER, description: "수량" },
        },
        required: ["name", "price"],
      },
      description: "구매한 품목 목록",
    },
  },
  required: ["merchantName", "date", "totalAmount", "items"],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "파일이 업로드되지 않았습니다." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 형식의 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type || "image/jpeg",
            },
          },
          {
            text: "이 영수증/결제내역 이미지에서 가맹점명, 일자, 총금액, 품목들을 추출해 지정된 JSON 스키마 규격으로 응답해줘.",
          },
        ],
      },
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema: receiptSchema,
    };

    // 3.5-flash 우선 시도 -> 503/에러 발생 시 3.5-flash-lite로 폴백
    const candidateModels = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
    let responseText = "";
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        responseText = response.text || "";
        if (responseText) break;
      } catch (err) {
        lastError = err;
        console.warn(`[${model}] 호출 실패, 다음 모델로 재시도...`);
      }
    }

    if (!responseText) {
      throw lastError || new Error("데이터 추출에 실패했습니다.");
    }

    const parsedData = JSON.parse(responseText);
    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: unknown) {
    console.error("추출 에러:", error);
    const message = error instanceof Error ? error.message : "데이터 추출 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
