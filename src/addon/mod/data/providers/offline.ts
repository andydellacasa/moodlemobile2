// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { CoreLoggerProvider } from '@providers/logger';
import { CoreSitesProvider } from '@providers/sites';
import { CoreTextUtilsProvider } from '@providers/utils/text';
import { CoreFileProvider } from '@providers/file';

/**
 * Service to handle Offline data.
 */
@Injectable()
export class AddonModDataOfflineProvider {

    protected logger;

    // Variables for database.
    protected SURVEY_TABLE = 'addon_mod_data_entry';
    protected tablesSchema = [
        {
            name: this.SURVEY_TABLE,
            columns: [
                {
                    name: 'dataid',
                    type: 'INTEGER'
                },
                {
                    name: 'courseid',
                    type: 'INTEGER'
                },
                {
                    name: 'groupid',
                    type: 'INTEGER'
                },
                {
                    name: 'action',
                    type: 'TEXT'
                },
                {
                    name: 'entryid',
                    type: 'INTEGER'
                },
                {
                    name: 'fields',
                    type: 'TEXT'
                },
                {
                    name: 'timemodified',
                    type: 'INTEGER'
                }
            ],
            primaryKeys: ['dataid', 'entryid']
        }
    ];

    constructor(logger: CoreLoggerProvider, private sitesProvider: CoreSitesProvider, private textUtils: CoreTextUtilsProvider,
            private fileProvider: CoreFileProvider) {
        this.logger = logger.getInstance('AddonModDataOfflineProvider');
        this.sitesProvider.createTablesFromSchema(this.tablesSchema);
    }

    /**
     * Delete all the actions of an entry.
     *
     * @param  {number} dataId   Database ID.
     * @param  {number} entryId  Database entry ID.
     * @param  {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>}         Promise resolved if deleted, rejected if failure.
     */
    deleteAllEntryActions(dataId: number, entryId: number, siteId?: string): Promise<any> {
        return this.getEntryActions(dataId, entryId, siteId).then((actions) => {
            const promises = [];

            actions.forEach((action) => {
                promises.push(this.deleteEntry(dataId, entryId, action.action, siteId));
            });

            return Promise.all(promises);
        });
    }

    /**
     * Delete an stored entry.
     *
     * @param  {number} dataId       Database ID.
     * @param  {number} entryId      Database entry Id.
     * @param  {string} action       Action to be done
     * @param  {string} [siteId]     Site ID. If not defined, current site.
     * @return {Promise<any>}             Promise resolved if deleted, rejected if failure.
     */
    deleteEntry(dataId: number, entryId: number, action: string, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.getDb().deleteRecords(this.SURVEY_TABLE, {dataid: dataId, entryid: entryId, action: action});
        });
    }

    /**
     * Get all the stored entry data from all the databases.
     *
     * @param  {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>}         Promise resolved with entries.
     */
    getAllEntries(siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.getDb().getAllRecords(this.SURVEY_TABLE);
        });
    }

    /**
     * Get all the stored entry data from a certain database.
     *
     * @param  {number} dataId     Database ID.
     * @param  {string} [siteId]   Site ID. If not defined, current site.
     * @return {Promise<any>}           Promise resolved with entries.
     */
    getDatabaseEntries(dataId: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.getDb().getRecords(this.SURVEY_TABLE, {dataid: dataId});
        });
    }

    /**
     * Get an all stored entry actions data.
     *
     * @param  {number} dataId      Database ID.
     * @param  {number} entryId     Database entry Id.
     * @param  {string} [siteId]    Site ID. If not defined, current site.
     * @return {Promise<any>}            Promise resolved with entry actions.
     */
    getEntryActions(dataId: number, entryId: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.getDb().getRecords(this.SURVEY_TABLE, {dataid: dataId, entryid: entryId});
        });
    }

    /**
     * Check if there are offline entries to send.
     *
     * @param  {number} dataId    Database ID.
     * @param  {string} [siteId]  Site ID. If not defined, current site.
     * @return {Promise<any>}          Promise resolved with boolean: true if has offline answers, false otherwise.
     */
    hasOfflineData(dataId: number, siteId?: string): Promise<any> {
        return this.getDatabaseEntries(dataId, siteId).then((entries) => {
            return !!entries.length;
        }).catch(() => {
            // No offline data found, return false.
            return false;
        });
    }

    /**
     * Get the path to the folder where to store files for offline files in a database.
     *
     * @param  {number} dataId      Database ID.
     * @param  {string} [siteId]    Site ID. If not defined, current site.
     * @return {Promise<string>}    Promise resolved with the path.
     */
    protected getDatabaseFolder(dataId: number, siteId?: string): Promise<string> {
        return this.sitesProvider.getSite(siteId).then((site) => {

            const siteFolderPath = this.fileProvider.getSiteFolder(site.getId()),
                folderPath = 'offlinedatabase/' + dataId;

            return this.textUtils.concatenatePaths(siteFolderPath, folderPath);
        });
    }

    /**
     * Get the path to the folder where to store files for a new offline entry.
     *
     * @param  {number} dataId      Database ID.
     * @param  {number} entryId     The ID of the entry.
     * @param  {number} fieldId     Field ID.
     * @param  {string} [siteId]    Site ID. If not defined, current site.
     * @return {Promise<string>}    Promise resolved with the path.
     */
    getEntryFieldFolder(dataId: number, entryId: number, fieldId: number, siteId?: string): Promise<string> {
        return this.getDatabaseFolder(dataId, siteId).then((folderPath) => {
            return this.textUtils.concatenatePaths(folderPath, entryId + '_' + fieldId);
        });
    }
}
