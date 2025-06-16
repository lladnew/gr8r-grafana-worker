// v1.0.0 gr8r-grafana-worker: centralized logging for Loki
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/api/logger") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const { level = "info", message, labels = {} } = await request.json();

      if (!message) {
        return new Response("Missing 'message' field", { status: 400 });
      }

      const timestampNs = Date.now() * 1e6; // Convert ms to ns
      const streamLabels = Object.entries({ level, ...labels })
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");

      const lokiPayload = {
        streams: [
          {
            stream: { level, ...labels },
            values: [[`${timestampNs}`, message]]
          }
        ]
      };

      const lokiResponse = await fetch(`${env.GRAFANA_LOKI_URL}/loki/api/v1/push`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${env.GRAFANA_USERNAME}:${env.GRAFANA_API_KEY}`)}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(lokiPayload)
      });

      if (!lokiResponse.ok) {
        const errorText = await lokiResponse.text();
        return new Response(`Loki error: ${errorText}`, { status: 502 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(`Unexpected error: ${err.message}`, { status: 500 });
    }
  }
};
