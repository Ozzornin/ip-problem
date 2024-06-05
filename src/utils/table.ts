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
}
