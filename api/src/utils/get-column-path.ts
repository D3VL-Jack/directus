import type { Relation } from '@directus/shared/types';
import { getRelationInfo } from './get-relation-info.js';
import { InvalidQueryException } from '../exceptions/index.js';
import { get } from 'lodash-es';

type AliasMap = string | { [key: string]: AliasMap };

export type ColPathProps = {
	path: string[];
	collection: string;
	aliasMap: AliasMap;
	relations: Relation[];
};

/**
 * Converts a Directus field list path to the correct SQL names based on the constructed alias map.
 * For example: ['author', 'role', 'name'] -> 'ljnsv.name'
 * Also returns the target collection of the column: 'directus_roles'
 */
export function getColumnPath({ path, collection, aliasMap, relations }: ColPathProps) {
	return followRelation(path);

	function followRelation(
		pathParts: string[],
		parentCollection: string = collection,
		parentAlias?: string
	): { columnPath: string; targetCollection: string } {
		/**
		 * For A2M fields, the path can contain an optional collection scope <field>:<scope>
		 */
		const pathRoot = pathParts[0]!.split(':')[0]!;
		const { relation, relationType } = getRelationInfo(relations, parentCollection, pathRoot);

		if (!relation) {
			throw new InvalidQueryException(`"${parentCollection}.${pathRoot}" is not a relational field`);
		}

		const alias = get(aliasMap, parentAlias ? [parentAlias, ...pathParts] : pathParts);
		const remainingParts = pathParts.slice(1);

		let parent: string;

		if (relationType === 'a2o') {
			const pathScope = pathParts[0]!.split(':')[1];

			if (!pathScope) {
				throw new InvalidQueryException(`You have to provide a collection scope when sorting on a many-to-any item`);
			}

			parent = pathScope;
		} else if (relationType === 'm2o') {
			parent = relation.related_collection!;
		} else {
			parent = relation.collection;
		}

		if (remainingParts.length === 1) {
			return { columnPath: `${alias || parent}.${remainingParts[0]}`, targetCollection: parent };
		}

		if (remainingParts.length) {
			return followRelation(remainingParts, parent, alias);
		}

		return { columnPath: '', targetCollection: '' };
	}
}
