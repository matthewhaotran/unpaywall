/** Strip scripts and paywall overlays, make relative assets resolve against the origin. */
const OVERLAY_CSS = `
html,body{overflow:auto!important;position:static!important;height:auto!important}
[class*="paywall" i],[id*="paywall" i],[class*="gateway" i],[id*="gateway" i],
[class*="regwall" i],[class*="subscribe-wall" i],[class*="meter" i][class*="modal" i],
[class*="modal-backdrop" i],[class*="overlay" i][class*="sub" i],
[data-testid*="paywall" i],[data-testid*="regi" i],#fides-overlay,#onetrust-consent-sdk{display:none!important}
[class*="locked" i],[class*="truncated" i],[class*="fade" i]{max-height:none!important;height:auto!important;
  -webkit-mask-image:none!important;mask-image:none!important;overflow:visible!important}
`;

export function clean(html: string, baseUrl: string): string {
  let out = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, "$1")
    .replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  const inject = `<base href="${baseUrl.replace(/"/g, "&quot;")}"><style>${OVERLAY_CSS}</style>`;
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => m + inject) : inject + out;
}
