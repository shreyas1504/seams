export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: { paper: "#F6F3EC", ink: "#14171F", muted: "#5B5F68", line: "#E2DDD2", leak: "#C22A25",
      overdue: "#8A5A00", overdueBg: "#FBEFD6", credit: "#17734B", creditBg: "#E6F4EC",
      crm: "#2F5BD3", wh: "#D9731A", bill: "#1F8A5B", ap: "#7A4FC9" },
    fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
  } },
};
