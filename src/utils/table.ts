import { Fraction } from "mathjs";
import { Matrix, Vector } from "./simplex";

export class Table {
  public c: Vector;
  public A: Matrix;
  public b: Vector;
  public delta: Vector;
  public basis: Vector;
  public pivot_row: number;
  public pivot_column: number;
  public result: Fraction;

  constructor(
    c: Vector,
    A: Matrix,
    b: Vector,
    delta: Vector,
    basis: Vector,
    pivot_column: number,
    pivot_row: number,
    result: Fraction
  ) {
    this.c = c;
    this.A = A;
    this.b = b;
    this.delta = delta;
    this.basis = basis;
    this.pivot_row = pivot_row;
    this.pivot_column = pivot_column;
    this.result = result;
  }

  resStr(): string {
    let values = "";
    for (let i = 0; i < this.basis.length; i++) {
      if (this.b[i] == undefined)
        values += this.basis[i].name + " = " + 0 + "\n";
      else values += this.basis[i].name + " = " + this.b[i] + "\n";
    }

    return values;
  }
}
