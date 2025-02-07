/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IWorkspaceService } from './interfaces';
import { dragAndDropNotSupported, onlyMovingOneFileIsSupported, ProjectsFailedToLoad, UnknownProjectsError } from './constants';
import { WorkspaceTreeItem } from 'dataworkspace';
import { TelemetryReporter } from './telemetry';
import Logger from './logger';

/**
 * Tree data provider for the workspace main view
 */
export class WorkspaceTreeDataProvider implements vscode.TreeDataProvider<WorkspaceTreeItem>, vscode.TreeDragAndDropController<WorkspaceTreeItem> {
	dropMimeTypes = ['application/vnd.code.tree.WorkspaceTreeDataProvider'];
	dragMimeTypes = []; // The recommended mime type of the tree (`application/vnd.code.tree.WorkspaceTreeDataProvider`) is automatically added.

	constructor(private _workspaceService: IWorkspaceService) {
		this._workspaceService.onDidWorkspaceProjectsChange(() => {
			return this.refresh();
		});

		vscode.window.createTreeView('dataworkspace.views.main', { canSelectMany: false, treeDataProvider: this, dragAndDropController: this });
	}

	private _onDidChangeTreeData: vscode.EventEmitter<void | WorkspaceTreeItem | null | undefined> | undefined = new vscode.EventEmitter<WorkspaceTreeItem | undefined | void>();
	readonly onDidChangeTreeData?: vscode.Event<void | WorkspaceTreeItem | null | undefined> | undefined = this._onDidChangeTreeData?.event;

	async refresh(): Promise<void> {
		Logger.log(`Refreshing projects tree`);
		await this._workspaceService.getProjectsInWorkspace(undefined, true);
		this._onDidChangeTreeData?.fire();
	}

	getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.treeDataProvider.getTreeItem(element.element);
	}

	async getChildren(element?: WorkspaceTreeItem | undefined): Promise<WorkspaceTreeItem[]> {
		if (element) {
			const items = await element.treeDataProvider.getChildren(element.element);
			return items ? items.map(item => <WorkspaceTreeItem>{ treeDataProvider: element.treeDataProvider, element: item }) : [];
		}
		else {
			// if the element is undefined return the project tree items
			Logger.log(`Calling getProjectsInWorkspace() from getChildren()`);
			const projects = await this._workspaceService.getProjectsInWorkspace(undefined, false);
			await vscode.commands.executeCommand('setContext', 'isProjectsViewEmpty', projects.length === 0);
			const unknownProjects: string[] = [];
			const treeItems: WorkspaceTreeItem[] = [];

			const typeMetric: Record<string, number> = {};

			let errorCount = 0;
			for (const project of projects) {
				try {
					const projectProvider = await this._workspaceService.getProjectProvider(project);

					this.incrementProjectTypeMetric(typeMetric, project);

					if (projectProvider === undefined) {
						unknownProjects.push(project.path);
						continue;
					}
					const treeDataProvider = await projectProvider.getProjectTreeDataProvider(project);
					if (treeDataProvider.onDidChangeTreeData) {
						treeDataProvider.onDidChangeTreeData((e: any) => {
							this._onDidChangeTreeData?.fire(e);
						});
					}
					const children = await treeDataProvider.getChildren(element);
					children?.forEach(child => {
						treeItems.push({
							treeDataProvider: treeDataProvider,
							element: child
						});
					});
				} catch (e) {
					errorCount++;
					console.error(e.message);
				}
			}

			if (errorCount > 0) {
				void vscode.window.showErrorMessage(ProjectsFailedToLoad);
			}

			TelemetryReporter.sendMetricsEvent(typeMetric, 'OpenWorkspaceProjectTypes');
			TelemetryReporter.sendMetricsEvent(
				{
					'handled': projects.length - unknownProjects.length,
					'unhandled': unknownProjects.length
				},
				'OpenWorkspaceProjectsHandled');

			if (unknownProjects.length > 0) {
				void vscode.window.showErrorMessage(UnknownProjectsError(unknownProjects));
			}

			return treeItems;
		}
	}

	private incrementProjectTypeMetric(typeMetric: Record<string, number>, projectUri: vscode.Uri) {
		const ext = path.extname(projectUri.fsPath);

		if (!typeMetric.hasOwnProperty(ext)) {
			typeMetric[ext] = 0;
		}

		typeMetric[ext]++;
	}

	handleDrag(treeItems: readonly WorkspaceTreeItem[], dataTransfer: vscode.DataTransfer): void | Thenable<void> {
		dataTransfer.set('application/vnd.code.tree.WorkspaceTreeDataProvider', new vscode.DataTransferItem(treeItems.map(t => t.element)));
	}

	async handleDrop(target: WorkspaceTreeItem | undefined, sources: vscode.DataTransfer): Promise<void> {
		if (!target) {
			return;
		}

		const transferItem = sources.get('application/vnd.code.tree.WorkspaceTreeDataProvider');

		// Only support moving one file at a time
		// canSelectMany is set to false for the WorkspaceTreeDataProvider, so this condition should never be true
		if (transferItem?.value.length > 1) {
			void vscode.window.showErrorMessage(onlyMovingOneFileIsSupported);
			return;
		}

		const projectUri = transferItem?.value[0].projectFileUri;
		if (!projectUri) {
			return;
		}

		const projectProvider = await this._workspaceService.getProjectProvider(projectUri);
		if (!projectProvider) {
			return;
		}

		if (!projectProvider?.supportsDragAndDrop || !projectProvider.moveFile) {
			void vscode.window.showErrorMessage(dragAndDropNotSupported);
			return;
		}

		// Move the file
		await projectProvider!.moveFile(projectUri, transferItem?.value[0], target);
		void this.refresh();
	}
}
