import * as fs from 'fs'
import * as path from 'path'
import * as chalk from 'chalk'
import { State, createValidator } from './dataFileSchema'
import { ValidationError } from 'jsonschema'
import { readCsvFile } from './readCsvFile'

/**
 * Validate that state-level data files adhere to the schema
 */
function validateDataFiles() {
	const validator = createValidator()
	const root = path.join(__dirname, '../data/states')
	const files = fs.readdirSync(root)
	const validStringIds = getValidStringIds()

	let errorCount: number = 0
	let schemaValidationErrors: ValidationError[] = []
	let linkErrors: string[] = []

	// Validate each state file
	files
		.filter((f) => f.endsWith('.json'))
		.forEach((file) => {
			const filePath = path.join(root, file)
			const data = require(filePath)
			const validationResult = validator.validate(data, State)
			const dataLinkErrors: string[] = []
			checkStringIds(data, validStringIds, dataLinkErrors)
			linkErrors.push(...dataLinkErrors)
			schemaValidationErrors.push(...validationResult.errors)
			errorCount += dataLinkErrors.length + validationResult.errors.length

			// handle results
			if (validationResult.errors.length === 0 && dataLinkErrors.length === 0) {
				console.log(chalk.green(`✔ ${file}`))
			}
			if (validationResult.errors.length > 0) {
				console.log(
					chalk.red(
						`❌ ${file} has ${validationResult.errors.length} schema errors`
					)
				)
			}
			if (dataLinkErrors.length > 0) {
				console.log(chalk.red(`❌ ${file} has ${dataLinkErrors} linker errors`))
			}
		})

	if (errorCount > 0) {
		if (schemaValidationErrors.length > 0) {
			console.log(schemaValidationErrors)
		}
		if (linkErrors.length > 0) {
			console.log(linkErrors)
		}
		console.log('💥 ' + chalk.red(`${errorCount} errors`))
		process.exit(1)
	} else {
		console.log('🚀 ' + chalk.green(`all files passed schema validation`))
	}
}
validateDataFiles()

function getValidStringIds(): Set<string> {
	const localizationTableFile = path.join(__dirname, '../dist/localization.csv')
	const records: Record<string, any>[] = []
	readCsvFile(localizationTableFile, records)

	let recordIds = records.map((r) => r['String ID'])
	const result = new Set<string>()
	recordIds.forEach((r) => result.add(r))
	if (result.size !== recordIds.length) {
		console.log(chalk.yellow('duplicate ids detected'))
	}
	return result
}

function checkStringIds(
	stateData: Record<string, any>,
	validStrings: Set<string>,
	errors: string[]
) {
	stateData.c19.vaccination.phases.forEach((phase: any) => {
		phase.qualifications.forEach((qual: any) => {
			if (!validStrings.has(qual)) {
				errors.push(`no defined string, "${qual}"`)
			}
		})
	})
	if (stateData.regions != null) {
		stateData.regions.forEach((region: any) => {
			checkStringIds(region, validStrings, errors)
		})
	}
}
