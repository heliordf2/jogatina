export default function Numpad({ disabledNums, activeNum, onEnterNum, disabled = false }) {
  return (
    <div className={`numpad${disabled ? ' numpad-disabled' : ''}`}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button
          key={n}
          type="button"
          className={`num-btn${activeNum === n ? ' active-num' : ''}`}
          disabled={disabled || disabledNums.has(n)}
          onClick={() => onEnterNum(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className="num-btn erase"
        disabled={disabled}
        onClick={() => onEnterNum(0)}
      >
        ⌫ Apagar
      </button>
    </div>
  );
}
