import Card from "./Card";
import UiIcon from "./UiIcon";

export default function SummaryCard({
  icon,
  label,
  value,
  note,
  tone = "neutral",
  showStatusDot = false,
}) {
  return (
    <Card className={`lwSummaryCard tone-${tone}${showStatusDot ? " lwSummaryCardStatus" : ""}`}>
      <div className="lwSummaryCardTop">
        <span className={`lwSummaryCardIcon ${tone}`}>
          <UiIcon name={icon} size={18} />
        </span>
        <div className="lwSummaryCardLabel">{label}</div>
      </div>

      <div className="lwSummaryValueRow">
        {showStatusDot ? <span className={`lwStatusGlowDot ${tone}`} /> : null}
        <div className="lwSummaryCardValue">{value}</div>
      </div>

      <div className="lwSummaryCardNote">{note}</div>
    </Card>
  );
}
