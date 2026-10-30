import { useStore } from '../state/store';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useStore();
  return (
    <Modal open={!!confirm} onClose={closeConfirm} labelledBy="cfTitle" narrow>
      <header><h2 id="cfTitle">{confirm?.title}</h2></header>
      <div className="body"><p style={{ margin: 0 }}>{confirm?.msg}</p></div>
      <footer>
        <button className="btn" type="button" onClick={closeConfirm}>Cancel</button>
        <button
          className="btn primary"
          type="button"
          onClick={() => {
            const fn = confirm?.onYes;
            closeConfirm();
            fn?.();
          }}
        >
          {confirm?.yesLabel ?? 'Continue'}
        </button>
      </footer>
    </Modal>
  );
}
