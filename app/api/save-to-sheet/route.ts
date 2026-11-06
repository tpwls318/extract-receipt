import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

interface ReceiptItemInput {
  name?: string;
  price?: number;
  count?: number;
}

interface SaveReceiptBody {
  merchantName?: string;
  date?: string;
  totalAmount?: number;
  taxAmount?: number;
  items?: ReceiptItemInput[];
}

export async function POST(req: NextRequest) {
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { error: "구글 시트 연동을 위한 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SaveReceiptBody;
    const { merchantName = "", date = "", totalAmount = 0, taxAmount = 0, items = [] } = body;

    if (!merchantName && !totalAmount) {
      return NextResponse.json(
        { error: "저장할 영수증 데이터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 품목 리스트를 "아메리카노 x1, 카페라떼 x2" 형태의 문자열로 요약
    const itemsSummary =
      Array.isArray(items) && items.length > 0
        ? items
            .filter((item) => item.name)
            .map((item) => `${item.name}${item.count ? ` x${item.count}` : ""}`)
            .join(", ")
        : "-";

    // 구글 서비스 계정 인증
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 시트 이름을 생략한 "A:E" 범위를 사용하여 첫 번째 시트 탭(시트1, Sheet1 등)에 상관없이 맨 아래 빈 행에 추가
    // 열 구성: A(결제일자), B(가맹점), C(총 금액), D(부가세), E(품목 요약)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[date, merchantName, totalAmount, taxAmount, itemsSummary]],
      },
    });

    return NextResponse.json({ success: true, message: "구글 시트 저장 성공" });
  } catch (error: unknown) {
    console.error("구글 시트 저장 에러:", error);
    const message = error instanceof Error ? error.message : "시트 저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
