import Pos2d, { Pos3d } from "./util/shape-math";

export enum EntityType {
  Character = "character",
  Floor = "floor",
  Ping = "ping",
}

export interface Ping {
  type: EntityType.Ping;
  id: string;
  pos: Pos2d;
}

export enum ContentType {
  Icon = "icon",
  Text = "text",
}

export interface IconContents {
  type: ContentType.Icon;
  iconId: string;
}

export interface TextContents {
  type: ContentType.Text;
  text: string;
}

export type TokenContents = IconContents | TextContents;

export interface Color {
  red: number;
  green: number;
  blue: number;
}

export interface Token {
  type: EntityType.Floor | EntityType.Character;
  id: string;
  pos: Pos3d;
  contents: TokenContents;
  color?: Color;
}

export type Entity = Ping | Token;

export function contentId(contents: TokenContents) {
  return contents.type === ContentType.Text
    ? `text-${contents.text}`
    : `icon-${contents.iconId}`;
}
