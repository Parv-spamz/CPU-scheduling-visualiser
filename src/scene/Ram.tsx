import { RAM_BANK, RAM_SLOT, RAM_SLOT_COUNT, ramSlotRect } from './layout';

const PAD = RAM_SLOT.x - RAM_BANK.x; // bank margin around the slots
const CONTACT = { width: PAD * 0.4, height: RAM_SLOT.height * 0.5 };

/** RAM module holding the ready queue: 8 slots, slot 0 is the front. */
export default function Ram() {
  return (
    <g pointerEvents="none">
      <text x={RAM_BANK.x} y={RAM_BANK.y - PAD * 0.7} className="silk">
        RAM · READY QUEUE
      </text>
      <rect x={RAM_BANK.x} y={RAM_BANK.y} width={RAM_BANK.width} height={RAM_BANK.height} rx={PAD / 2} className="dimm" />
      {Array.from({ length: RAM_SLOT_COUNT }, (_, i) => {
        const r = ramSlotRect(i);
        const midY = r.y + r.height / 2;
        return (
          <g key={i}>
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              rx={PAD / 3}
              className={i === 0 ? 'ram-slot ram-slot-front' : 'ram-slot'}
            />
            {/* Gold contact on the right edge of the module */}
            <rect
              x={RAM_BANK.x + RAM_BANK.width - CONTACT.width - PAD * 0.15}
              y={midY - CONTACT.height / 2}
              width={CONTACT.width}
              height={CONTACT.height}
              className="ram-contact"
            />
            <text x={r.x + PAD * 0.6} y={midY} dominantBaseline="central" className="silk-dim mono">
              {i}
            </text>
          </g>
        );
      })}
      <text
        x={RAM_BANK.x + RAM_BANK.width}
        y={RAM_BANK.y + RAM_BANK.height + PAD * 1.3}
        textAnchor="end"
        className="silk-dim"
      >
        slot 0 = front of queue
      </text>
    </g>
  );
}
