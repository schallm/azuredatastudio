/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { isString } from 'vs/base/common/types';

export class LongTextViewer<T extends Slick.SlickData>{
	private _content: HTMLElement;
	private _wrapper: HTMLElement;

	constructor(private _args: Slick.Editors.EditorOptions<T>) {
		this.init();
	}

	public init(): void {
		const container = document.body;
		const wrapperStyling = `z-index:10000;position:absolute;background:white;padding:5px;border:3px solid gray; -moz-border-radius:10px; border-radius:10px;`;
		this._wrapper = DOM.$('.longTextViewer-container');
		this._wrapper.setAttribute('style', wrapperStyling);
		container.appendChild(this._wrapper);
		this._content = DOM.$('span');
		const contentStyling = 'backround:white;width:250px;height:80px;border:0;outline:0;user-select:text';
		this._content.setAttribute('style', contentStyling);
		this._wrapper.appendChild(this._content);
		this.position((<any>this._args).position);
		this._content.focus();
	}

	public handleKeyDown(e: DOMEvent): void {
	}

	public save(): void {

	}

	public cancel(): void {
	}

	public hide(): void {
		this._wrapper.style.display = 'none';
	}

	public show(): void {
		this._wrapper.style.display = '';
	}

	public destroy(): void {
	}

	public focus(): void {
		this._content.focus();
	}

	public loadValue(item: any): void {
		if (isString(item)) {
			this._content.innerText = item;
		} else {
			this._content.innerText = item.text;
		}
	}

	public applyValue(item: any, state: string): void {
		item[this._args.column.field] = state;
	}

	public isValueChanged(): boolean {
		return false;
	}

	public validate(): Slick.ValidateResults {
		return {
			valid: true,
			msg: null
		};
	}

	public position(position: Slick.Position): void {
		this._wrapper.style.top = (position.top - 5) + 'px';
		this._wrapper.style.left = (position.left - 5) + 'px';
	}

	public serializeValue(): string {
		return '';
	}
}
