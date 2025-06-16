// v1.0.4 gr8r-grafana-worker: ensures consistent log labels for visibility in Loki
//ADDED fallback enforcement for meta.source and meta.service, replacing empty or missing values with "unspecified" and "unknown_service" respectively.
//UPDATED label assignment logic to prevent invisible logs due to empty labels.
//MAINTAINED existing structure, error handling, and log streaming format.

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const { level = "info", message = "No message provided", meta = {} } = body;

      // Ensure required labels are always present and valid
      const source = (typeof meta.source === "string" && meta.source.trim()) ? meta.source : "unspecified";
      const service = (typeof meta.service === "string" && meta.service.trim()) ? meta.service : "unknown_service";

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

