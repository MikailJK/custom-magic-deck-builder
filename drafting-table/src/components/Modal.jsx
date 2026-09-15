export default function Modal({ children, width = 520, onClose, closeOnOverlayClick = true }) {
  return (
    <div className="dt-modal-overlay" onClick={closeOnOverlayClick ? onClose : undefined}>
      <div className="dt-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
