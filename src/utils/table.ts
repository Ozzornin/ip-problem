import { Matrix, Vector } from "./simplex";

export class Table {
  public c: Vector;
  public A: Matrix;
  public b: Vector;
  public delta: Vector;
  public basis: Vector;

  constructor(c: Vector, A: Matrix, b: Vector, delta: Vector, basis: Vector) {
    this.c = c;
    this.A = A;
    this.b = b;
    this.delta = delta;
    this.basis = basis;
  }

  result(): string {
    let values = "";
    for (let i = 0; i < this.basis.length; i++) {
      if (this.b[i] == undefined)
        values += this.basis[i].name + " = " + 0 + "\n";
      else values += this.basis[i].name + " = " + this.b[i] + "\n";
    }

    return values;
  }
}
