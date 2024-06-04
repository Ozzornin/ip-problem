import { Fraction } from "mathjs";
import { VarType } from "./enums";

export class VarNum {
  private _type: VarType;
  private _value: number;
  private _name: string;

  constructor(type: VarType, value: number, name: string = "") {
    this._type = type;
    this._value = value;
    this._name = name;
  }

  get type(): VarType {
    return this._type;
  }
  get value(): number {
    return this._value;
  }

  set value(value: number) {
    this._value = value;
  }

  get name(): string {
    return this._name;
  }
}

export class FractionNum {
  private _type: VarType;
  private _value: Fraction;
  private _name: string;

  constructor(type: VarType, value: Fraction, name: string = "") {
    this._type = type;
    this._value = value;
    this._name = name;
  }

  get type(): VarType {
    return this._type;
  }
  get value(): Fraction {
    return this._value;
  }

  set value(value: Fraction) {
    this._value = value;
  }

  get name(): string {
    return this._name;
  }
}
