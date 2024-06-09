import { MinMaxFunction, VarType } from "./enums";
import { FractionNum } from "./varnum";
import {
  fraction,
  add,
  multiply,
  subtract,
  Fraction,
  divide,
  number,
  isInteger,
  floor,
  abs,
} from "mathjs";
import { Table } from "./table";

export interface Vector extends Array<any> {}
export interface Matrix extends Array<Vector> {}

export class SimplexMethod {
  private c_vec: Vector;
  private a_matrix: Matrix;
  private b_vec: Vector;
  public table: SimplexTable = new SimplexTable([], [], [], []);
  private constraint_types: string[];
  private _num_vars: number;
  private _num_constraints: number;
  private _basis: Vector = [];
  public _tables: Table[] = [];
  public minmax: MinMaxFunction = MinMaxFunction.Max;
  public isInteger: boolean = false;

  constructor(
    func_vec: Vector,
    conditions_matrix: Matrix,
    constraints_vec: Vector,
    constraint_types: string[],
    minmax: MinMaxFunction,
    isInteger: boolean
  ) {
    this.c_vec = func_vec.map(
      (val, index) =>
        new FractionNum(VarType.Regular, fraction(val), `x${index + 1}`)
    );

    this.minmax = minmax;
    this.isInteger = isInteger;

    this.a_matrix = conditions_matrix.map((row) =>
      row.map((val) => fraction(val))
    );

    this.b_vec = constraints_vec.map((val) => fraction(val));

    this.constraint_types = constraint_types;

    this._num_vars = this.c_vec.length;
    this._num_constraints = this.a_matrix.length;

    this.canonize();
    this._initialize_simplex_table();
  }

  private canonize() {
    if (this.minmax === MinMaxFunction.Min) {
      this.c_vec.map(
        (val) => (val.value = multiply(fraction(val.value), fraction(-1)))
      );
    }

    for (let i = 0; i < this.b_vec.length; i++) {
      if (this.b_vec[i].s < 0) {
        this.b_vec[i].s *= -1;
        this.a_matrix[i] = this.a_matrix[i].map((val) =>
          multiply(val, fraction(-1))
        );
        if (this.constraint_types[i] === "<=") {
          this.constraint_types[i] = ">=";
        } else if (this.constraint_types[i] === ">=") {
          this.constraint_types[i] = "<=";
        }
      }
    }
  }

  private _initialize_simplex_table() {
    let numOfSlack = 0;
    let numOfArtificial = 0;

    for (let i = 0; i < this._num_constraints; i++) {
      let slack: Vector = new Array(this._num_constraints).fill(fraction(0));
      slack[i] = fraction(1);

      if (this.constraint_types[i] === "<=") {
        numOfSlack++;
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(slack[rowIndex])
        );
        this.c_vec.push(
          new FractionNum(VarType.Slack, fraction(0), `s${numOfSlack}`)
        );
        this._basis.push(
          new FractionNum(VarType.Slack, fraction(0), `s${numOfSlack}`)
        );
      } else if (this.constraint_types[i] === ">=") {
        numOfSlack++;
        numOfArtificial++;
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(multiply(slack[rowIndex], fraction(-1)))
        );
        let artificial: Vector = new Array(this._num_constraints).fill(
          fraction(0)
        );
        artificial[i] = fraction(1);
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(artificial[rowIndex])
        );
        this.c_vec.push(
          new FractionNum(VarType.Slack, fraction(0), `s${numOfSlack}`)
        );
        this.c_vec.push(
          new FractionNum(
            VarType.Artificial,
            fraction(1),
            `a${numOfArtificial}`
          )
        );
        this._basis.push(
          new FractionNum(
            VarType.Artificial,
            fraction(1),
            `a${numOfArtificial}`
          )
        );
      } else {
        numOfArtificial++;
        let artificial: Vector = new Array(this._num_constraints).fill(
          fraction(0)
        );
        artificial[i] = fraction(1);
        this.a_matrix = this.a_matrix.map((row, rowIndex) =>
          row.concat(artificial[rowIndex])
        );
        this.c_vec.push(
          new FractionNum(
            VarType.Artificial,
            fraction(1),
            `a${numOfArtificial}`
          )
        );
        this._basis.push(
          new FractionNum(
            VarType.Artificial,
            fraction(1),
            `a${numOfArtificial}`
          )
        );
      }
    }

    this.table = new SimplexTable(
      [...this.c_vec],
      [...this.a_matrix],
      [...this.b_vec],
      [...this._basis]
    );
  }

  public solve(): Table[] {
    if (!this._check_artificial_vars_out()) {
      this._phase_one();
    }

    this.table.saves.push(
      "Штучні змінні не в базисі, обчислюємо наступну симплекс таблицю до оптимального розв'язку."
    );
    this._phase_two();
    if (this.isInteger)
      while (!this.chech_if_result_is_integer()) {
        this.table.saves.push(
          "Розв'язок не цілочисельний, обчислюємо наступну симплекс таблицю."
        );
        this._phase_three();
      }
    this.table.saves.push("Результуюча симплекс таблиця");
    this.table.save();
    this.table.saves[this.table.saves.length - 1].pivot_column = -1;
    this.table.saves[this.table.saves.length - 1].pivot_row = -1;
    this.table.get_solution();
    return this.table.saves;
  }

  private _phase_one() {
    let artificial_obj: Vector = [];
    for (let i = 0; i < this.table?.c.length; i++) {
      const el: FractionNum = this.table?.c[i];
      if (this.table?.c[i]?.type != VarType.Artificial) {
        artificial_obj.push(new FractionNum(el.type, fraction(0), el.name));
      } else {
        artificial_obj.push(new FractionNum(el.type, el.value, el.name));
      }
    }
    this.table.saves.push(
      "Змінюємо коефіцієнти у цільовій функції для того щоб штучні змінні першими вийшли з базису."
    );
    this.table.c = artificial_obj;

    while (!this._check_artificial_vars_out()) {
      this.table?.solve();
    }
  }

  private _check_artificial_vars_out(): boolean {
    if (this.table.basis.find((val) => val.type == VarType.Artificial)) {
      return false;
    }
    return true;
  }

  private _phase_two() {
    this.table.c = this.c_vec;

    for (let i = 0; i < this.table.c.length; i++) {
      if (this.table.c[i].type == VarType.Artificial) {
        this.table.c.splice(i, 1);
        this.table.A = this.table.A.map((row) => {
          row.splice(i, 1);
          return row;
        });
        this.table.delta.splice(i, 1);
      }

      for (const element of this.table.c) {
        for (let j = 0; j < this.table.basis.length; j++) {
          if (
            (this.table.basis[j].name as FractionNum) ==
            (element.name as FractionNum)
          ) {
            this.table.basis[j] = element;
          }
        }
      }
    }

    while (!this.is_optimal()) this.table.solve(true);
  }

  private _phase_three() {
    const constraint: Fraction[] = [];
    let index = 0;

    for (let i = 0; i < this.table.basis.length; i++) {
      if (
        this.table.basis[i].type == VarType.Regular &&
        !isInteger(number(this.table.b[i]))
      ) {
        index = i;
        break;
      }
    }

    constraint.push(
      ...this.table.A[index].map((val) => {
        let frac = fraction(subtract(val, floor(val)));
        frac.s *= -1;
        return frac;
      })
    );

    const numOfSlack = this.table.c.filter(
      (val) => val.type == VarType.Slack
    ).length;
    const newSlack = new FractionNum(
      VarType.Slack,
      fraction(0),
      `s${numOfSlack + 1}`
    );

    let basis = fraction(
      subtract(this.table.b[index], floor(this.table.b[index]))
    );
    basis.s *= -1;
    this.table.b.push(basis);
    this.table.basis.push(newSlack);
    this.table.c.push(newSlack);
    this.table.delta.push(fraction(0));
    this.table.A.push([...constraint]);

    for (let i = 0; i < this.table.A.length; i++) {
      if (i != this.table.A.length - 1) {
        this.table.A[i].push(fraction(0));
      } else {
        this.table.A[i].push(fraction(1));
      }
    }
    this.table.save();

    this.table.saves[this.table.saves.length - 1].pivot_column = -1;
    this.table.saves[this.table.saves.length - 1].pivot_row = -1;
    this.table.saves.push("Додаємо нову умову щоб позбутися дробовості");
    this.table.reverse_simplex();
  }

  private chech_if_result_is_integer(): boolean {
    let result: boolean = true;
    for (let i = 0; i < this.table.basis.length; i++) {
      if (this.table.basis[i].type == VarType.Regular) {
        if (!isInteger(number(this.table.b[i]))) {
          result = false;
          break;
        }
      }
    }
    return result;
  }

  private is_optimal(): boolean {
    const delta = this.table.get_delta();
    if (delta.every((val) => number(val) >= 0)) {
      return true;
    }
    return false;
  }
}

class SimplexTable {
  public c: Vector;
  public A: Matrix;
  public b: Vector;
  public delta: Vector = [];
  public basis: Vector = [];
  public saves: any[] = [];
  public pivot_column: number = 0;
  public pivot_row: number = 0;
  public result: Fraction = fraction(0);

  constructor(c: Vector, A: Matrix, b: Vector, basis: Vector) {
    this.c = c;
    this.A = A;
    this.b = b;
    this.basis = basis;
    this.delta = new Array(this.c.length).fill(0);

    this.saves.push("Початкова таблиця");
    this.save();
    this.saves[this.saves.length - 1].pivot_column = -1;
    this.saves[this.saves.length - 1].pivot_row = -1;
  }

  public solve(pivot_column_min: boolean = false): void {
    this.pivot_column = this.get_pivot_column(pivot_column_min);
    this.pivot_row = this.get_pivot_row(this.pivot_column);
    this.pivot(this.pivot_row, this.pivot_column);
  }

  private get_pivot_column(min: boolean): number {
    this.delta = this.get_delta();
    let max = 0;
    if (!min) {
      max = Math.max(...this.delta.map((val) => number(val)));
    } else {
      max = Math.min(...this.delta.map((val) => number(val)));
    }
    for (let i = 0; i < this.delta.length; i++) {
      if (this.delta[i] == max) {
        return i;
      }
    }
    return -1;
  }

  public reverse_simplex(): void {
    this.pivot_row = this.get_pivot_row_r();
    this.pivot_column = this.get_pivot_column_r(this.pivot_row);
    this.saves.push(
      `Виконуємо обернений симплекс метод. Напрямний рядок - ${
        this.basis[this.pivot_row].name
      }, напрямний стовбець - ${this.c[this.pivot_column].name} `
    );
    this.pivot(this.pivot_row, this.pivot_column);
  }

  private get_pivot_column_r(row: number): number {
    let index = -1;

    let delta = this.get_delta();
    let ratios: Fraction[] = [];
    let ratios2: number[] = [];
    this.A[row].forEach((val, i) => {
      if (val != 0 && val != 1) {
        ratios2.push(i);
        ratios.push(fraction(abs(divide(delta[i], val))));
      } else ratios.push(fraction(0));
    });
    console.log(ratios);

    const min = Math.min(...ratios2.map((val) => number(ratios[val])));
    for (let i = 0; i < ratios.length; i++) {
      if (number(ratios[i]) == min) {
        index = i;
      }
    }
    return index;
  }

  private get_pivot_row_r(): number {
    let index = -1;
    let min = Math.min(...this.b.map((val) => number(val)));
    for (let i = 0; i < this.b.length; i++) {
      if (this.b[i] == min) {
        index = i;
        break;
      }
    }
    return index;
  }

  private get_pivot_row(pivot_column: number): number {
    const ratios: Fraction[] = [];
    this.A.forEach((row, i) => {
      if (number(row[pivot_column]) > 0) {
        ratios.push(fraction(divide(this.b[i], row[pivot_column])));
      } else {
        ratios.push(fraction(Number.MAX_SAFE_INTEGER));
      }
    });

    const min = Math.min(...ratios.map((val) => number(val)));
    for (let i = 0; i < ratios.length; i++) {
      if (number(ratios[i]) == min) {
        return i;
      }
    }
    return -1;
  }

  public get_delta(): Vector {
    const newDelta: Fraction[] = [];
    for (let i = 0; i < this.c.length; i++) {
      let sum = fraction(0);
      for (let j = 0; j < this.A.length; j++) {
        let basis = this.basis[j]?.value;
        let a = this.A[j][i];
        sum = add(sum, multiply(basis, a));
      }
      let c = this.c[i].value;
      newDelta.push(subtract(fraction(sum), c));
    }
    return newDelta;
  }

  private pivot(pivot_row: number, pivot_column: number): void {
    this.save();

    const new_a: Matrix = [];
    const new_b: Fraction[] = [];
    for (let i = 0; i < this.A.length; i++) {
      if (i === pivot_row) {
        new_a.push(
          this.A[i].map((val) => divide(val, this.A[pivot_row][pivot_column]))
        );
        new_b.push(
          fraction(divide(this.b[pivot_row], this.A[pivot_row][pivot_column]))
        );
      } else {
        new_a.push(
          this.A[i].map((val, j) =>
            subtract(
              val,
              divide(
                multiply(this.A[i][pivot_column], this.A[pivot_row][j]),
                this.A[pivot_row][pivot_column]
              )
            )
          )
        );
        new_b.push(
          subtract(
            this.b[i],
            divide(
              multiply(this.A[i][pivot_column], this.b[pivot_row]),
              this.A[pivot_row][pivot_column]
            )
          )
        );
      }
    }

    console.log(new_b.map((val) => fraction(val).toString()));
    if (
      this.basis[pivot_row].name.localeCompare(this.c[pivot_column].name) == 0
    ) {
      this.saves[this.saves.length - 1].pivot_column = -1;
      this.saves[this.saves.length - 1].pivot_row = -1;
      throw new Error("Не можливо визначити напрямний елемент.");
    }
    this.saves.push(
      `Вибираємо ведучий елемент - ${this.A[pivot_row][pivot_column]} (${
        pivot_row + 1
      }, ${pivot_column + 1})`
    );
    this.saves.push(
      `${this.basis[pivot_row].name} виходить з базису, ${this.c[pivot_column].name} входить в базис.`
    );
    this.basis[pivot_row] = this.c[pivot_column];
    this.b = new_b;
    this.A = new_a;
  }

  public get_Result(): Fraction {
    this.result = fraction(0);
    for (let i = 0; i < this.c.length; i++) {
      for (let j = 0; j < this.basis.length; j++) {
        if (this.c[i].name == this.basis[j].name) {
          this.result = add(this.result, multiply(this.c[i].value, this.b[j]));
        }
      }
    }

    return this.result;
  }

  public save() {
    this.saves.push(
      new Table(
        [...this.c],
        [...this.A],
        [...this.b],
        [...this.get_delta()],
        [...this.basis],
        this.pivot_column,
        this.pivot_row,
        this.get_Result()
      )
    );
  }

  public get_solution(): void {
    let result = this.get_Result();
    let solution: String[] = [];
    for (let i = 0; i < this.c.length; i++) {
      for (let j = 0; j < this.basis.length; j++) {
        if (
          this.c[i].name == this.basis[j].name &&
          this.c[i].type == VarType.Regular
        ) {
          solution.push(`x${i + 1}=` + this.b[j]);
        }
      }
    }
    this.saves.push(
      "Оптимальне рішення: " + solution.concat(" ") + ` F = ${result}`
    );
  }
}
