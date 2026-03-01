import { NextRequest, NextResponse } from "next/server";

// POST /api/chart-review — Proxy to XPC Chart Review API
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (level: "log" | "warn" | "error", ...args: unknown[]) =>
    console[level](`[chart-review][${requestId}]`, ...args);

  try {
    const apiUrl = process.env.CHART_REVIEW_API_URL;
    const apiSecret = process.env.CHART_REVIEW_API_SECRET;

    if (!apiUrl || !apiSecret) {
      log("warn", "API not configured — missing", {
        CHART_REVIEW_API_URL: !!apiUrl,
        CHART_REVIEW_API_SECRET: !!apiSecret,
      });
      return NextResponse.json(
        { error: "Chart review API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Transform flat client payload into the structure the XPC API expects
    const xpcPayload = {
      patient: { name: body.patientName, dob: body.patientDob },
      encounter: { date: body.encounterDate },
      provider: { name: body.providerName },
      notes: body.noteText,
    };

    log("log", "→ POST", `${apiUrl}/chart_reviews`, {
      patient: body.patientName,
      dob: body.patientDob,
      encounterDate: body.encounterDate,
      provider: body.providerName,
      noteLength: body.noteText?.length ?? 0,
    });

    const startTime = Date.now();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/chart_reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Key": apiSecret,
        },
        body: JSON.stringify(xpcPayload),
      });
    } catch (fetchError) {
      const elapsed = Date.now() - startTime;
      log("error", `← NETWORK ERROR after ${elapsed}ms:`, {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
        code: (fetchError as NodeJS.ErrnoException).code,
      });

      return NextResponse.json(
        { error: "Failed to connect to chart review API" },
        { status: 502 }
      );
    }

    const elapsed = Date.now() - startTime;
    const responseHeaders = Object.fromEntries(response.headers.entries());

    log("log", `← ${response.status} ${response.statusText} in ${elapsed}ms`, {
      headers: responseHeaders,
    });

    const rawBody = await response.text();
    log("log", `← Response body:`, rawBody);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      log("error", `Non-JSON response (${response.status}):`, {
        contentType,
        bodyPreview: rawBody.slice(0, 500),
      });
      return NextResponse.json(
        { error: `Chart review API returned non-JSON response (${response.status})` },
        { status: 502 }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch (parseError) {
      log("error", "Failed to parse JSON response:", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        bodyPreview: rawBody.slice(0, 500),
      });
      return NextResponse.json(
        { error: `Chart review API returned invalid JSON (${response.status})` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      log("error", `API error (${response.status}):`, JSON.stringify(data));
      const errorMessage =
        (data as { errors?: string[] }).errors?.join("; ") || `Chart review API error (${response.status})`;
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    log("error", "Unhandled exception:", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach chart review API",
      },
      { status: 500 }
    );
  }
}
