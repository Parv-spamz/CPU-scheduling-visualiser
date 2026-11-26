import { ALGORITHMS, ALGORITHM_LABEL } from '../../engine/types';
import { fmt2 } from '../../scene/resultsModel';
import { useApp } from '../../store/useApp';

/** Screen-reader-only plain table of the comparison (the visible results live on the hardware). */
export default function ResultsTable() {
  const compare = useApp((s) => s.compare);
  if (!compare) return null;
  return (
    <table className="sr-only">
      <caption>
        Algorithm comparison. Winner: {ALGORITHM_LABEL[compare.winner]}. {compare.reason}
      </caption>
      <thead>
        <tr>
          <th scope="col">Algorithm</th>
          <th scope="col">Average waiting</th>
          <th scope="col">Average turnaround</th>
          <th scope="col">Average response</th>
          <th scope="col">Context switches</th>
        </tr>
      </thead>
      <tbody>
        {ALGORITHMS.map((id) => {
          const r = compare.runs[id];
          return (
            <tr key={id}>
              <th scope="row">{ALGORITHM_LABEL[id]}</th>
              <td>{fmt2(r.averages.waiting)}</td>
              <td>{fmt2(r.averages.turnaround)}</td>
              <td>{fmt2(r.averages.response)}</td>
              <td>{r.contextSwitches}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
