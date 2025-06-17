// v1.0.7 gr8r-grafana-worker: adds visible diagnostics for log success/failure
//ADDED verbose `console.log` output for successful push payload and Loki response
//ADDED fallback console.error with raw payload if logging fails
//RETAINED consistent fallback label structure from v1.0.5
// added line 8 console.log("📥 Incoming request to Grafana Worker");

export default {
  async fetch(request, env) {
    console.log("📥 Incoming request to Grafana Worker");
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const { level = "info", message = "No message provided", meta = {} } = body;

      const source = (typeof meta.source === "string" && meta.source.trim()) ? meta.source : "gr8r-fallback";
      const service = (typeof meta.service === "string" && meta.service.trim()) ? meta.service : "gr8r-unknown";

      const timestamp = Date.now() * 1_000_000; // nanoseconds

      const stream = {
        stream: {
          level,
          source,
          service_name: service
        },
        values: [[`${timestamp}`, message]]
      };

      const lokiUrl = env.GRAFANA_LOKI_URL;
      const username = env.GRAFANA_USERNAME;
      const apiKey = env.GRAFANA_API_KEY;
      const authHeader = 'Basic ' + btoa(`${username}:${apiKey}`);

      const payload = JSON.stringify({ streams: [stream] });

      console.log("📤 Loki Payload:", payload);

      const response = await fetch(`${lokiUrl}/loki/api/v1/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: payload
      });

      const responseText = await response.text();
      console.log("✅ Loki Response Code:", response.status);
      console.log("📨 Loki Response Body:", responseText);

      if (!response.ok) {
        console.error("❌ Loki push failed:", response.status, responseText);
        return new Response(`Loki error: ${responseText}`, { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("❌ Unexpected Worker Error:", err.message);
      return new Response(`Unexpected error: ${err.message}`, { status: 500 });
    }
  }
}
