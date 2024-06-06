import React from "react";
import styles from "./objinput.module.scss";

interface ObjInputProps {
  index: number;
  value: string;
  setObjFunc: (index: number, value: string) => void;
}

export default function ObjInput({
  index,
  value,
  setObjFunc,
}: ObjInputProps): JSX.Element {
  return (
    <>
      <input
        className={styles.numInput}
        type="text"
        name="number"
        value={value}
        onChange={(e) => setObjFunc(index, e.target.value)}
      />
      <label htmlFor="number" className={styles.label}>
        x{index + 1}
      </label>
    </>
  );
}
