import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../lib/catalog-data/telecom-products.json"), "utf8"));
const outDir = path.resolve(__dirname, "../public/images/products");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getIconSvg(id) {
  if (id === "tel-inf-001" || id === "tel-inf-002") {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="260" y="160" width="280" height="440" rx="12" stroke="#2bd673" stroke-width="3" fill="#13231a" />
        <line x1="300" y1="160" x2="300" y2="600" stroke="#2e543e" stroke-dasharray="6,4" />
        <line x1="500" y1="160" x2="500" y2="600" stroke="#2e543e" stroke-dasharray="6,4" />
        <rect x="310" y="200" width="180" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <circle cx="325" cy="217" r="3" fill="#38e07b" />
        <circle cx="337" cy="217" r="3" fill="#38e07b" />
        <line x1="360" y1="217" x2="470" y2="217" stroke="#2bd673" stroke-width="2" />
        <rect x="310" y="250" width="180" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <circle cx="325" cy="267" r="3" fill="#38e07b" />
        <rect x="310" y="300" width="180" height="70" rx="4" fill="#162c20" stroke="#2bd673" />
        <line x1="320" y1="335" x2="480" y2="335" stroke="#2e543e" />
        <rect x="310" y="390" width="180" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <rect x="310" y="440" width="180" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <rect x="310" y="490" width="180" height="80" rx="4" fill="#162c20" stroke="#2bd673" />
        <rect x="515" y="340" width="12" height="60" rx="4" fill="#38e07b" />
      </g>`;
  }

  if (id === "tel-inf-003" || id === "tel-inf-004" || id === "tel-inf-005") {
    return `
      <g stroke="#38e07b" stroke-width="2.5" fill="none" opacity="0.9">
        <ellipse cx="400" cy="380" rx="180" ry="110" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <ellipse cx="400" cy="320" rx="180" ry="110" fill="#183023" stroke="#38e07b" stroke-width="3" />
        <ellipse cx="400" cy="320" rx="90" ry="55" fill="#101e16" stroke="#2bd673" />
        <circle cx="400" cy="320" r="28" fill="#0d1812" stroke="#38e07b" />
        <path d="M 230,335 C 230,420 570,420 570,335" stroke="#2bd673" stroke-width="8" stroke-linecap="round" />
        <path d="M 240,355 C 240,430 560,430 560,355" stroke="#38e07b" stroke-width="7" stroke-linecap="round" />
        <path d="M 250,375 C 250,440 550,440 550,375" stroke="#2bd673" stroke-width="6" stroke-linecap="round" />
        <path d="M 540,330 Q 610,340 620,260 T 560,200" stroke="#38e07b" stroke-width="5" fill="none" />
        <rect x="535" y="180" width="35" height="30" rx="4" fill="#38e07b" stroke="#fff" stroke-width="1" />
      </g>`;
  }

  if (id === "tel-inf-006" || id === "tel-inf-007" || id === "tel-inf-008") {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="180" y="320" width="440" height="100" rx="8" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="150" y="310" width="30" height="120" rx="4" fill="#1b3326" stroke="#38e07b" stroke-width="2" />
        <circle cx="165" cy="330" r="5" fill="#0d1812" stroke="#2bd673" />
        <circle cx="165" cy="410" r="5" fill="#0d1812" stroke="#2bd673" />
        <rect x="620" y="310" width="30" height="120" rx="4" fill="#1b3326" stroke="#38e07b" stroke-width="2" />
        <circle cx="635" cy="330" r="5" fill="#0d1812" stroke="#2bd673" />
        <circle cx="635" cy="410" r="5" fill="#0d1812" stroke="#2bd673" />
        ${Array.from({ length: 12 }, (_, i) => `
          <rect x="${205 + i * 34}" y="345" width="24" height="24" rx="3" fill="#1b3627" stroke="#38e07b" />
          <rect x="${210 + i * 34}" y="357" width="14" height="8" fill="#0e1b13" stroke="#2bd673" />
          <circle cx="${217 + i * 34}" cy="382" r="2.5" fill="#38e07b" />
        `).join("")}
      </g>`;
  }

  if (id === "tel-inf-009" || id === "tel-inf-010") {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="270" y="200" width="260" height="380" rx="24" fill="#15261d" stroke="#2bd673" stroke-width="4" />
        <rect x="305" y="240" width="190" height="170" rx="10" fill="#0d1712" stroke="#38e07b" stroke-width="2" />
        <line x1="320" y1="360" x2="400" y2="290" stroke="#2bd673" stroke-width="3" />
        <line x1="400" y1="290" x2="430" y2="330" stroke="#2bd673" stroke-width="3" />
        <line x1="430" y1="330" x2="475" y2="270" stroke="#38e07b" stroke-width="3" />
        <rect x="320" y="255" width="60" height="18" rx="4" fill="#2bd673" />
        <text x="350" y="268" font-family="monospace" font-size="11" font-weight="bold" fill="#0d1812" text-anchor="middle">PASS</text>
        <line x1="320" y1="380" x2="475" y2="380" stroke="#1f3b2c" stroke-width="2" />
        <circle cx="400" cy="460" r="28" fill="#1c3628" stroke="#38e07b" stroke-width="3" />
        <circle cx="400" cy="460" r="10" fill="#38e07b" />
        <rect x="320" y="520" width="60" height="24" rx="6" fill="#1a3325" stroke="#2bd673" />
        <rect x="420" y="520" width="60" height="24" rx="6" fill="#1a3325" stroke="#2bd673" />
      </g>`;
  }

  if (id.startsWith("tel-eqt-011") || id.startsWith("tel-eqt-012")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="160" y="310" width="480" height="130" rx="8" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="180" y="340" width="65" height="50" rx="4" fill="#0c1711" stroke="#38e07b" stroke-width="2" />
        <circle cx="212" cy="365" r="12" fill="#1b3827" stroke="#2bd673" />
        ${Array.from({ length: 12 }, (_, i) => `
          <rect x="${265 + i * 24}" y="335" width="18" height="20" rx="2" fill="#1d3829" stroke="#38e07b" stroke-width="1.5" />
          <circle cx="${274 + i * 24}" cy="330" r="2" fill="#2bd673" />
          <rect x="${265 + i * 24}" y="365" width="18" height="20" rx="2" fill="#1d3829" stroke="#38e07b" stroke-width="1.5" />
          <circle cx="${274 + i * 24}" cy="390" r="2" fill="#2bd673" />
        `).join("")}
        <rect x="565" y="340" width="26" height="45" rx="3" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <rect x="597" y="340" width="26" height="45" rx="3" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <circle cx="578" cy="332" r="2.5" fill="#38e07b" />
        <circle cx="610" cy="332" r="2.5" fill="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-eqt-013") || id.startsWith("tel-eqt-014")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="200" y="290" width="400" height="160" rx="12" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        ${Array.from({ length: 16 }, (_, i) => `
          <line x1="${230 + i * 22}" y1="305" x2="${230 + i * 22}" y2="335" stroke="#224230" stroke-width="4" stroke-linecap="round" />
        `).join("")}
        ${Array.from({ length: 8 }, (_, i) => `
          <rect x="${230 + i * 36}" y="365" width="24" height="26" rx="3" fill="#1b3627" stroke="#38e07b" />
          <circle cx="${242 + i * 36}" cy="402" r="2.5" fill="${i < 2 ? "#fff" : "#2bd673"}" />
        `).join("")}
        <rect x="525" y="360" width="35" height="34" rx="4" fill="#0c1711" stroke="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-eqt-015") || id.startsWith("tel-eqt-016")) {
    return `
      <g stroke="#38e07b" stroke-width="2.5" fill="none" opacity="0.9">
        <circle cx="400" cy="370" r="160" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        <circle cx="400" cy="370" r="110" stroke="#1f3b2c" stroke-width="2" stroke-dasharray="8,6" />
        <circle cx="400" cy="370" r="60" stroke="#2bd673" stroke-width="2" />
        <circle cx="400" cy="370" r="20" fill="#38e07b" />
        <path d="M 330,220 A 180,180 0 0,1 470,220" stroke="#38e07b" stroke-width="3" stroke-linecap="round" />
        <path d="M 300,180 A 230,230 0 0,1 500,180" stroke="#2bd673" stroke-width="2.5" stroke-linecap="round" opacity="0.6" />
        <path d="M 270,140 A 280,280 0 0,1 530,140" stroke="#38e07b" stroke-width="2" stroke-linecap="round" opacity="0.3" />
      </g>`;
  }

  if (id.startsWith("tel-eqt-017") || id.startsWith("tel-eqt-018")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="240" y="320" width="320" height="110" rx="8" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="220" y="340" width="30" height="70" rx="6" fill="#1f3b2c" stroke="#38e07b" stroke-width="2" />
        <rect x="510" y="340" width="40" height="30" rx="4" fill="#0d1712" stroke="#38e07b" />
        <rect x="510" y="380" width="40" height="30" rx="4" fill="#0d1712" stroke="#38e07b" />
        <rect x="250" y="350" width="60" height="50" rx="4" fill="#1b3627" stroke="#2bd673" />
        ${Array.from({ length: 6 }, (_, i) => `
          <line x1="${260 + i * 8}" y1="360" x2="${260 + i * 8}" y2="390" stroke="#38e07b" stroke-width="3" />
        `).join("")}
      </g>`;
  }

  if (id.startsWith("tel-eqt-019") || id.startsWith("tel-eqt-020")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="220" y="240" width="360" height="280" rx="12" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        ${Array.from({ length: 6 }, (_, i) => `
          <rect x="${260 + i * 48}" y="215" width="22" height="30" rx="2" fill="#203f2e" stroke="#38e07b" stroke-width="2" />
          <circle cx="${271 + i * 48}" cy="230" r="4" fill="#0d1812" />
        `).join("")}
        <rect x="260" y="290" width="280" height="130" rx="8" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <path d="M 280,390 Q 320,310 350,330 T 420,300 T 480,360 T 520,380" stroke="#2bd673" stroke-width="3" fill="none" />
        <rect x="350" y="515" width="24" height="28" rx="2" fill="#203f2e" stroke="#38e07b" />
        <rect x="420" y="515" width="24" height="28" rx="2" fill="#203f2e" stroke="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-dom-021") || id.startsWith("tel-dom-022")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="260" y="270" width="280" height="220" rx="36" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        <circle cx="400" cy="380" r="50" stroke="#38e07b" stroke-width="3" fill="#1b3627" />
        <circle cx="400" cy="380" r="22" fill="#38e07b" />
        <path d="M 330,310 A 100,100 0 0,1 470,310" stroke="#2bd673" stroke-width="3" stroke-linecap="round" />
        <path d="M 300,280 A 150,150 0 0,1 500,280" stroke="#38e07b" stroke-width="2.5" stroke-linecap="round" opacity="0.6" />
      </g>`;
  }

  if (id.startsWith("tel-dom-023") || id.startsWith("tel-dom-024")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="270" y="230" width="260" height="300" rx="12" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="250" y="340" width="25" height="80" rx="3" fill="#1e3a2b" stroke="#38e07b" />
        <rect x="525" y="340" width="25" height="80" rx="3" fill="#1e3a2b" stroke="#38e07b" />
        ${Array.from({ length: 4 }, (_, i) => `
          <circle cx="${310 + i * 60}" cy="265" r="14" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
          <line x1="${300 + i * 60}" y1="265" x2="${320 + i * 60}" y2="265" stroke="#2bd673" stroke-width="2" />
        `).join("")}
        <rect x="300" y="320" width="200" height="90" rx="6" fill="#0d1812" stroke="#2bd673" stroke-width="2" />
        <text x="400" y="365" font-family="monospace" font-size="24" font-weight="bold" fill="#38e07b" text-anchor="middle">230.4 V</text>
        <text x="400" y="392" font-family="monospace" font-size="14" fill="#2bd673" text-anchor="middle">16.0 A · 3680 W</text>
      </g>`;
  }

  if (id.startsWith("tel-dom-025") || id.startsWith("tel-dom-026")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="280" y="240" width="240" height="280" rx="24" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="310" y="275" width="180" height="140" rx="8" fill="#eaf2ec" stroke="#2bd673" stroke-width="2" />
        <text x="400" y="325" font-family="sans-serif" font-size="32" font-weight="bold" fill="#0e1b13" text-anchor="middle">21.8 °C</text>
        <text x="400" y="360" font-family="sans-serif" font-size="18" font-weight="bold" fill="#2b543b" text-anchor="middle">48% RH · TVOC</text>
        <circle cx="400" cy="465" r="18" fill="#1b3827" stroke="#38e07b" stroke-width="2" />
        <circle cx="400" cy="465" r="6" fill="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-dom-027") || id.startsWith("tel-dom-028")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="310" y="190" width="180" height="380" rx="28" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <circle cx="400" cy="260" r="38" fill="#0c1711" stroke="#38e07b" stroke-width="3" />
        <circle cx="400" cy="260" r="16" fill="#1d3829" stroke="#2bd673" />
        <circle cx="400" cy="260" r="6" fill="#38e07b" />
        <rect x="340" y="330" width="120" height="110" rx="8" fill="#0d1812" stroke="#2bd673" stroke-width="2" />
        <circle cx="370" cy="360" r="8" fill="#1a3325" />
        <circle cx="400" cy="360" r="8" fill="#1a3325" />
        <circle cx="430" cy="360" r="8" fill="#1a3325" />
        <circle cx="370" cy="390" r="8" fill="#1a3325" />
        <circle cx="400" cy="390" r="8" fill="#1a3325" />
        <circle cx="430" cy="390" r="8" fill="#1a3325" />
        <circle cx="400" cy="495" r="32" fill="#1a3827" stroke="#38e07b" stroke-width="3" />
        <circle cx="400" cy="495" r="14" fill="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-dom-029") || id.startsWith("tel-dom-030")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <circle cx="400" cy="360" r="140" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        <circle cx="400" cy="360" r="110" stroke="#1f3b2c" stroke-width="12" stroke-dasharray="12,6" />
        <circle cx="400" cy="360" r="85" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <text x="400" y="375" font-family="sans-serif" font-size="48" font-weight="bold" fill="#38e07b" text-anchor="middle">21.5°</text>
        <path d="M 330,410 Q 400,430 470,410" stroke="#2bd673" stroke-width="3" fill="none" />
      </g>`;
  }

  if (id.startsWith("tel-tel-031") || id.startsWith("tel-tel-032")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="220" y="270" width="360" height="210" rx="14" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="250" y="300" width="130" height="50" rx="4" fill="#0d1712" stroke="#38e07b" stroke-width="2" />
        <text x="315" y="332" font-family="monospace" font-size="14" font-weight="bold" fill="#38e07b" text-anchor="middle">IP-PBX 1000U</text>
        <rect x="410" y="300" width="32" height="30" rx="3" fill="#1a3325" stroke="#2bd673" />
        <rect x="450" y="300" width="32" height="30" rx="3" fill="#1a3325" stroke="#2bd673" />
        <rect x="490" y="300" width="32" height="30" rx="3" fill="#1a3325" stroke="#2bd673" />
        <rect x="530" y="300" width="32" height="30" rx="3" fill="#1a3325" stroke="#2bd673" />
        <rect x="250" y="390" width="36" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <rect x="295" y="390" width="36" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
        <rect x="340" y="390" width="36" height="34" rx="4" fill="#1a3325" stroke="#38e07b" />
      </g>`;
  }

  if (id.startsWith("tel-tel-033") || id.startsWith("tel-tel-034")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="250" y="230" width="300" height="300" rx="16" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="280" y="260" width="180" height="100" rx="6" fill="#0d1712" stroke="#38e07b" stroke-width="2" />
        <circle cx="310" cy="290" r="12" fill="#1f3b2c" />
        <line x1="335" y1="285" x2="430" y2="285" stroke="#38e07b" stroke-width="3" />
        <line x1="335" y1="305" x2="400" y2="305" stroke="#2bd673" stroke-width="2" />
        <rect x="480" y="210" width="55" height="330" rx="20" fill="#193325" stroke="#38e07b" stroke-width="3" />
        ${Array.from({ length: 9 }, (_, i) => `
          <rect x="${290 + (i % 3) * 45}" y="${390 + Math.floor(i / 3) * 36}" width="36" height="26" rx="4" fill="#1a3325" stroke="#2bd673" />
        `).join("")}
      </g>`;
  }

  if (id.startsWith("tel-tel-035") || id.startsWith("tel-tel-036")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="180" y="310" width="440" height="130" rx="8" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        ${Array.from({ length: 8 }, (_, i) => `
          <rect x="${220 + i * 44}" y="335" width="28" height="24" rx="3" fill="#1b3627" stroke="#38e07b" />
          <rect x="${220 + i * 44}" y="375" width="28" height="24" rx="3" fill="#1b3627" stroke="#38e07b" />
        `).join("")}
        <rect x="580" y="350" width="30" height="36" rx="4" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
      </g>`;
  }

  if (id.startsWith("tel-tel-037") || id.startsWith("tel-tel-038")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="250" y="270" width="300" height="220" rx="12" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="280" y="150" width="16" height="120" rx="4" fill="#1d3b2a" stroke="#38e07b" stroke-width="2" />
        <rect x="504" y="150" width="16" height="120" rx="4" fill="#1d3b2a" stroke="#38e07b" stroke-width="2" />
        <rect x="290" y="420" width="40" height="40" rx="4" fill="#193325" stroke="#38e07b" />
        <rect x="345" y="420" width="40" height="40" rx="4" fill="#193325" stroke="#38e07b" />
        ${Array.from({ length: 5 }, (_, i) => `
          <rect x="${430 + i * 16}" y="${360 - i * 10}" width="10" height="${30 + i * 10}" rx="2" fill="#38e07b" />
        `).join("")}
      </g>`;
  }

  if (id.startsWith("tel-tel-039") || id.startsWith("tel-tel-040")) {
    return `
      <g stroke="#38e07b" stroke-width="2.5" fill="none" opacity="0.9">
        <rect x="350" y="180" width="100" height="320" rx="40" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        <rect x="330" y="380" width="140" height="40" rx="6" fill="#1b3627" stroke="#38e07b" stroke-width="2" />
        <circle cx="345" cy="400" r="6" fill="#0d1812" stroke="#2bd673" />
        <circle cx="455" cy="400" r="6" fill="#0d1812" stroke="#2bd673" />
        <path d="M 380,500 L 380,580 Q 380,610 350,610" stroke="#38e07b" stroke-width="6" stroke-linecap="round" fill="none" />
        <path d="M 420,500 L 420,580 Q 420,610 450,610" stroke="#2bd673" stroke-width="6" stroke-linecap="round" fill="none" />
      </g>`;
  }

  if (id.startsWith("tel-dig-041") || id.startsWith("tel-dig-042") || id.startsWith("tel-dig-043") || id.startsWith("tel-dig-044")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="220" y="240" width="360" height="280" rx="14" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        ${Array.from({ length: 12 }, (_, i) => `
          <line x1="${255 + i * 26}" y1="210" x2="${255 + i * 26}" y2="240" stroke="#254b35" stroke-width="6" stroke-linecap="round" />
        `).join("")}
        <rect x="260" y="280" width="60" height="40" rx="4" fill="#1b3827" stroke="#38e07b" />
        <rect x="340" y="280" width="60" height="40" rx="4" fill="#1b3827" stroke="#38e07b" />
        <rect x="430" y="280" width="40" height="40" rx="4" fill="#0d1812" stroke="#2bd673" />
        <rect x="485" y="280" width="40" height="40" rx="4" fill="#0d1812" stroke="#2bd673" />
        ${Array.from({ length: 8 }, (_, i) => `
          <rect x="${260 + i * 32}" y="420" width="22" height="40" rx="3" fill="#1a3626" stroke="#38e07b" />
          <circle cx="${271 + i * 32}" cy="440" r="3" fill="#38e07b" />
        `).join("")}
      </g>`;
  }

  if (id.startsWith("tel-dig-045") || id.startsWith("tel-dig-046")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="230" y="230" width="340" height="300" rx="16" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        ${Array.from({ length: 4 }, (_, i) => `
          <rect x="${265 + i * 65}" y="260" width="50" height="200" rx="6" fill="#1b3627" stroke="#38e07b" stroke-width="2" />
          <rect x="${275 + i * 65}" y="280" width="30" height="25" rx="3" fill="#0d1812" stroke="#2bd673" />
          <circle cx="${290 + i * 65}" cy="430" r="4" fill="#38e07b" />
        `).join("")}
        <circle cx="535" cy="490" r="14" fill="#1b3827" stroke="#38e07b" stroke-width="2" />
        <circle cx="535" cy="490" r="5" fill="#38e07b" />
      </g>`;
  }

  if (id.startsWith("ref-storage-")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="220" y="320" width="360" height="120" rx="6" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="560" y="340" width="20" height="80" rx="2" fill="#ffd700" stroke="#b89700" />
        <rect x="440" y="345" width="70" height="70" rx="4" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <text x="475" y="385" font-family="monospace" font-size="12" font-weight="bold" fill="#38e07b" text-anchor="middle">PCIe 4.0</text>
        <rect x="330" y="345" width="90" height="70" rx="4" fill="#1b3827" stroke="#2bd673" />
        <text x="375" y="385" font-family="monospace" font-size="12" fill="#2bd673" text-anchor="middle">3D NAND</text>
        <rect x="250" y="345" width="60" height="70" rx="4" fill="#1b3827" stroke="#2bd673" />
      </g>`;
  }

  if (id.startsWith("tel-dig-047") || id.startsWith("tel-dig-048")) {
    return `
      <g stroke="#38e07b" stroke-width="2.5" fill="none" opacity="0.9">
        <rect x="340" y="240" width="120" height="220" rx="8" fill="#14261c" stroke="#2bd673" stroke-width="3" />
        <rect x="375" y="190" width="50" height="50" rx="6" fill="#1b3827" stroke="#38e07b" stroke-width="2" />
        <rect x="365" y="460" width="70" height="70" rx="4" fill="#1b3827" stroke="#38e07b" stroke-width="2" />
        ${Array.from({ length: 4 }, (_, i) => `
          <line x1="365" y1="${475 + i * 14}" x2="435" y2="${475 + i * 14}" stroke="#2bd673" stroke-width="3" />
        `).join("")}
      </g>`;
  }

  if (id.startsWith("tel-dig-049") || id.startsWith("tel-dig-050")) {
    return `
      <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
        <rect x="270" y="180" width="260" height="420" rx="20" fill="#14261c" stroke="#2bd673" stroke-width="4" />
        <rect x="340" y="160" width="120" height="20" rx="4" fill="#ff3b30" stroke="#fff" stroke-width="1" />
        <rect x="295" y="220" width="210" height="280" rx="10" fill="#0d1812" stroke="#38e07b" stroke-width="2" />
        <line x1="315" y1="260" x2="485" y2="260" stroke="#2bd673" stroke-width="3" />
        <rect x="365" y="330" width="70" height="70" rx="4" fill="#1a3827" stroke="#38e07b" />
        <rect x="380" y="345" width="40" height="40" fill="#38e07b" />
      </g>`;
  }

  return `
    <g stroke="#38e07b" stroke-width="2" fill="none" opacity="0.9">
      <rect x="220" y="260" width="360" height="240" rx="16" fill="#14261c" stroke="#2bd673" stroke-width="3" />
      <circle cx="400" cy="380" r="60" fill="#183626" stroke="#38e07b" stroke-width="3" />
      <circle cx="400" cy="380" r="25" fill="#38e07b" />
    </g>`;
}

for (const product of p.products) {
  const iconGraphic = getIconSvg(product.id);
  const brandEsc = escapeXml(product.brand.toUpperCase());
  const modelEsc = escapeXml(product.modelNumber || product.sku);
  const nameEsc = escapeXml(product.name);
  const catEsc = escapeXml(product.category.toUpperCase());

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a120e" />
      <stop offset="50%" stop-color="#101d16" />
      <stop offset="100%" stop-color="#070c09" />
    </linearGradient>
    <radialGradient id="center-glow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#234c34" stop-opacity="0.45" />
      <stop offset="70%" stop-color="#101e16" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#0a120e" stop-opacity="0" />
    </radialGradient>
    <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1d3829" stroke-width="1" stroke-opacity="0.35" />
    </pattern>
  </defs>

  <rect width="800" height="800" fill="url(#bg-grad)" />
  <rect width="800" height="800" fill="url(#center-glow)" />
  <rect width="800" height="800" fill="url(#tech-grid)" />

  <rect x="24" y="24" width="752" height="752" rx="16" fill="none" stroke="#1f3d2b" stroke-width="1.5" stroke-opacity="0.7" />
  <line x1="24" y1="50" x2="50" y2="24" stroke="#38e07b" stroke-width="2" />
  <line x1="776" y1="50" x2="750" y2="24" stroke="#38e07b" stroke-width="2" />
  <line x1="24" y1="750" x2="50" y2="776" stroke="#38e07b" stroke-width="2" />
  <line x1="776" y1="750" x2="750" y2="776" stroke="#38e07b" stroke-width="2" />

  <g transform="translate(48, 48)">
    <rect x="0" y="0" width="310" height="32" rx="6" fill="#13261b" stroke="#2e5c3e" stroke-width="1.5" />
    <circle cx="16" cy="16" r="5" fill="#38e07b" />
    <text x="32" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#a8e6be" letter-spacing="1.2">NODRIA · ILUSTRACIÓN TÉCNICA</text>

    <rect x="325" y="0" width="375" height="32" rx="6" fill="#101e16" stroke="#254a32" stroke-width="1" />
    <text x="340" y="20" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#75b58c" letter-spacing="0.8">${catEsc}</text>
  </g>

  <g id="product-schematic">
    ${iconGraphic}
  </g>

  <g transform="translate(48, 650)">
    <rect x="0" y="0" width="130" height="24" rx="4" fill="#1b3626" stroke="#38e07b" stroke-width="1.2" />
    <text x="65" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#38e07b" letter-spacing="1.5" text-anchor="middle">${brandEsc}</text>

    <rect x="142" y="0" width="180" height="24" rx="4" fill="#0e1b13" stroke="#264c33" stroke-width="1" />
    <text x="152" y="16" font-family="'SF Mono', Consolas, Monaco, monospace" font-size="11" font-weight="600" fill="#7ce49f">MPN: ${modelEsc}</text>

    <text x="0" y="52" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ecf5ef" letter-spacing="-0.3">
      ${nameEsc.length > 58 ? nameEsc.slice(0, 56) + "…" : nameEsc}
    </text>

    <text x="0" y="78" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#7da68b">
      ESPECIFICACIÓN TÉCNICA DE REFERENCIA · ESQUEMA VECTORIAL
    </text>
  </g>
</svg>`;

  const outPath = path.join(outDir, `${product.id}.svg`);
  fs.writeFileSync(outPath, svgContent, "utf8");
}

console.log(`Generated 52 technical SVG product images in ${outDir}`);
