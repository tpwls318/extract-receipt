import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { merchantName, date, totalAmount, items } = body;

    // 품목 리스트를 "아메리카노 x1, 카페라떼 x2" 형태의 문자열로 요약
    const itemsSummary = items && items.length > 0
      ? items.map((item: any) => `${item.name}${item.count ? ` x${item.count}` : ""}`).join(", ")
      : "-";

    // 구글 서비스 계정 인증
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 스프레드시트의 맨 아래 빈 행에 추가 (A~D열)
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "시트1!A:D", // 기본 탭 이름이 한글인 경우 '시트1!A:D'로 변경
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[date, merchantName, totalAmount, itemsSummary]],
      },
    });

    return NextResponse.json({ success: true, message: "구글 시트 저장 성공" });
  } catch (error: any) {
    console.error("구글 시트 저장 에러:", error);
    return NextResponse.json({ error: error.message || "시트 저장 실패" }, { status: 500 });
  }
}