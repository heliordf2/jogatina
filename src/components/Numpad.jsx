export default function Numpad({ disabledNums, onEnterNum }) {
  return (
    <div className="numpad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button
          key={n}
          type="button"
          className="num-btn"
          disabled={disabledNums.has(n)}
          onClick={() => onEnterNum(n)}
        >
          {n}
        </button>
      ))}
      <button type="button" className="num-btn erase" onClick={() => onEnterNum(0)}>
        ⌫ Apagar
      </button>
    </div>
  );
}
