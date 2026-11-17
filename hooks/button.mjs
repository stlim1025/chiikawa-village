// Village time-of-day button for the mode row, in a bright pastel look.
// Pure ES module, no imports. Every design stays readable when colors are ignored.

export const VARIANTS = ["soft", "chip", "sticker"];

// Pastel foregrounds for a dark app background, plus a dark tint used behind the chip.
const PHASES = {
  새벽: { icon: "🌄", color: "#c9b6f2", tint: "#2f2a4a" },
  낮: { icon: "🌸", color: "#f6a7c1", tint: "#4a2a38" },
  노을: { icon: "🌇", color: "#ffb98a", tint: "#4a3324" },
  밤: { icon: "🌙", color: "#a8d8f0", tint: "#22344a" },
};

// Hour -> phase name. Used for "자동" and for hour parts such as "13시".
function phaseOfHour(hour) {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (h >= 5 && h < 8) return "새벽";
  if (h >= 8 && h < 17) return "낮";
  if (h >= 17 && h < 20) return "노을";
  return "밤";
}

// Resolves what to show: the phase (icon and colors), the short word, and whether it is automatic.
function resolve(part, hour) {
  const text = typeof part === "string" ? part : "자동";
  if (PHASES[text]) return { phase: PHASES[text], word: text, auto: false };
  if (text === "자동") return { phase: PHASES[phaseOfHour(hour)], word: phaseOfHour(hour), auto: true };
  const m = /^(\d{1,2})시$/.exec(text);
  const name = phaseOfHour(m ? Number(m[1]) : hour);
  return { phase: PHASES[name], word: text, auto: false };
}

// soft: quiet one-color text, e.g. "🌙 밤마을" / "🕰 자동·밤".
function softLabel({ phase, word, auto }) {
  if (auto) return `🕰 자동·${word}`;
  return word.endsWith("시") ? `${phase.icon} ${word} 마을` : `${phase.icon} ${word}마을`;
}

// chip: house first, the time-of-day icon last, e.g. "🏡 밤 🌙" / "🏡 자동 🌙".
function chipLabel({ phase, word, auto }) {
  return `🏡 ${auto ? "자동" : word} ${phase.icon}`;
}

// sticker: icon-forward with a tulip, e.g. "🌙 밤 🌷" / "🕰 자동 🌙".
function stickerLabel({ phase, word, auto }) {
  return auto ? `🕰 자동 ${phase.icon}` : `${phase.icon} ${word} 🌷`;
}

// part: "자동" | "새벽" | "낮" | "노을" | "밤" | e.g. "13시"; hour: the hour shown now (0~23), for "자동" too.
// Returns one element tree for the mode row, with the Button pressing onPress.
export function villageButton({ Box, Text, Button, part, hour, onPress, variant = VARIANTS[0] }) {
  const state = resolve(part, hour);
  const { phase } = state;

  if (variant === "chip") {
    return Box({
      flexDirection: "row",
      alignItems: "center",
      paddingX: 1,
      borderStyle: "round",
      borderColor: phase.color,
      backgroundColor: phase.tint,
      children: Button({
        key: "village-time",
        plain: true,
        onPress,
        children: Text({ color: phase.color, bold: true, children: chipLabel(state) }),
      }),
    });
  }

  if (variant === "sticker") {
    return Button({
      key: "village-time",
      variant: "secondary",
      onPress,
      children: Text({
        color: "#ffe7a3",
        weight: "semibold",
        children: stickerLabel(state),
      }),
    });
  }

  return Button({
    key: "village-time",
    plain: true,
    onPress,
    children: Text({ color: phase.color, children: softLabel(state) }),
  });
}
