// Shared artwork only: the knowledge-base chat integration is a later task.
export default function HrMascot({ size = 160, className = '', ...props }) {
  return <img src="/mascot/hr-penguin.png" width={size} height={size} alt="" draggable="false"
    className={className} {...props} />;
}
