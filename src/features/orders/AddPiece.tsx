import { useState } from "react";
import { CostEditor, emptyCost } from "../quotes/CostEditor";
import { Modal } from "../../components/business";
import { Notice } from "../../components/ui";
import { useOperation, type Catalog, type Order } from "../../lib/operations";
export function AddPiece({
  order,
  catalog,
  onClose,
}: {
  order: Order;
  catalog: Catalog;
  onClose: () => void;
}) {
  const [cost, setCost] = useState(emptyCost()),
    [description, setDescription] = useState(""),
    [quantity, setQuantity] = useState("1");
  const op = useOperation();
  return (
    <Modal title="Agregar pieza personalizada al pedido" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void op
            .run("order_line_save", {
              order_id: order.id,
              version: order.version,
              description,
              quantity,
              ...cost,
            })
            .then((r) => {
              if (r) onClose();
            });
        }}
      >
        <div className="business-form-grid">
          <label className="field">
            Descripción de la pieza
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Cantidad de piezas
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              type="number"
              min="1"
              max="100000"
              step="1"
              required
            />
          </label>
        </div>
        <CostEditor value={cost} onChange={setCost} catalog={catalog} />
        {op.error && <Notice>{op.error}</Notice>}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={op.busy}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={op.busy}>
            Agregar pieza
          </button>
        </div>
      </form>
    </Modal>
  );
}
