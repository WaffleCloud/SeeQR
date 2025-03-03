import faker from 'faker';
import { ColumnObj, DummyRecords, LogType } from '../BE_types';
import logger from '../Logging/masterlog';

const db = require('../models');

/*   THIS FILE CONTAINS THE ALGORITHMS THAT GENERATE DUMMY DATA    */
/*                                                                 */
/* - The async function below is called in channels.ts             */
/* - This process runs for each table where data is requested      */
/* - generateDummyData creates dummy data values in a table matrix */
/* - This matrix is returned inside the resolved promise, and is   */
/*     subsequently concatenated into the INSERT query generated   */
/*     in channels.ts to generate the dummy records for the table  */


// *************************************************** Helper Functions *************************************************** //

// helper function to generate random numbers that will ultimately represent a random date
const getRandomInt = (min: number, max: number) => {
  const minInt = Math.ceil(min);
  const maxInt = Math.floor(max);
  // The maximum is exclusive and the minimum is inclusive
  return Math.floor(Math.random() * (maxInt - minInt) + minInt); 
};


// helper function to generate random data based on a given column's data type
const generateDataByType = (columnObj: ColumnObj): string | number => {
  let length;
  // faker.js method to generate data by type
  switch (columnObj.data_type) {
    case 'smallint':
      return faker.random.number({ min: -32768, max: 32767 });
    case 'integer':
      return faker.random.number({ min: -2147483648, max: 2147483647 });
    case 'bigint':
      return faker.random.number({
        min: -9223372036854775808,
        max: 9223372036854775807,
      });
    case 'character varying':
      // defaulting length to 3 because faker.lorem defaults to a length of 3 if no length is specified

      length = columnObj.character_maximum_length && columnObj.character_maximum_length < 3
        ? Math.floor(Math.random() * columnObj.character_maximum_length)
        : 3;
      return '\''.concat(faker.random.alphaNumeric(length)).concat('\'');
    case 'date': {
      // generating a random date between 1500 and 2020
      const year = getRandomInt(1500, 2020).toString();
      let month = getRandomInt(1, 13).toString();
      if (month.length === 1) month = `0${month}`;
      let day = getRandomInt(1, 29).toString();
      if (day.length === 1) day = `0${day}`;
      const result = `${year}/${month}/${day}`;
      return '\''.concat(result).concat('\'');
    }
    case 'boolean': {
      return '\''.concat(faker.random.boolean()).concat('\'');
    }
    default:
      // console.log('Error generating dummy data by type');
      throw new Error('unhandled data type');
  }
};

// *************************************************** Main Function to Generate Dummy Data *************************************************** //

type GenerateDummyData = (tableInfo: ColumnObj[], numRows: number) => Promise<DummyRecords>;

const generateDummyData: GenerateDummyData = async (tableInfo: ColumnObj[], numRows: number) => {
  // assuming primary key is serial, get all the column names except for the column with the primary key
  const columnNames: Array<string> = [];
  for(let i = 0; i < tableInfo.length; i++) {
    columnNames.push(tableInfo[i].column_name);
  }
  
  const dummyRecords: DummyRecords = [columnNames];

  // generate dummy records for each row
  for (let i = 0; i < numRows; i += 1) {
    const row: (string | number)[] = [];
    // at each row, check the columns of the table and generate dummy data accordingly
    for (let j = 0; j < tableInfo.length; j += 1) {
      // if column has no foreign key constraint, then generate dummy data based on data type
      if (
        tableInfo[j].constraint_type !== 'FOREIGN KEY' 
        // && tableInfo[j].constraint_type !== 'PRIMARY KEY'
      ) row.push(generateDataByType(tableInfo[j]));
      
      // if there is a foreign key constraint, grab random key from foreign table 
      else if (tableInfo[j].constraint_type === 'FOREIGN KEY') {
        try {
          const foreignColumn = tableInfo[j].foreign_column;
          const foreignTable = tableInfo[j].foreign_table;
          const getForeignKeyQuery = `
            SELECT ${foreignColumn}
            FROM ${foreignTable} TABLESAMPLE BERNOULLI(100)
            LIMIT 1
          `;
          const foreignKey = await db.query(getForeignKeyQuery);
          const chosenPrimaryValue = foreignKey.rows[0][Object.keys(foreignKey.rows[0])[0]]
          if (foreignKey.rows.length) {
            if (typeof chosenPrimaryValue === 'string') row.push(`'${chosenPrimaryValue}'`);
            else row.push(chosenPrimaryValue);
          }
          else{
            logger('There was an error while retrieving a valid foreign key while generating dummy data.', LogType.ERROR);
            throw new Error('There was an error while retrieving a valid foreign key.');
          }
        }
        catch(err) {
          throw err;
        }
      }
    }
    dummyRecords.push(row);
  }
  return dummyRecords;
};

export default generateDummyData;
