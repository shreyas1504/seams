export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      paper: "#FAF7F2", card: "#FFFFFF", line: "#ECE4D8", ink: "#1C1917", muted: "#6B635A",
      forest: "#1F4D3A", owed: "#C2410C", owedFill: "#E8A585",
      overdue: "#9F1239", overdueBg: "#FBE8EC", credit: "#0F766E", creditBg: "#E2F3EF", chip: "#F1ECE4",
      crm: "#1E3A8A", crmBg: "#EAF1FD", wh: "#155E75", whBg: "#E3F4F6", bill: "#3F6212", billBg: "#ECF3E1",
      ap: "#6B21A8", apBg: "#F3EDFB", ret: "#9A4A00", retBg: "#FFF4E5",
    },
    fontFamily: {
      display: ["Fraunces", "Georgia", "serif"],
      sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
      mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
    },
    borderRadius: { card: "16px" },
    boxShadow: { lift: "0 10px 28px -12px rgba(28, 25, 23, 0.18)" },
  } },
};
