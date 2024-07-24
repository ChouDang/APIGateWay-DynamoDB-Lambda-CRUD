import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';

const db = DynamoDBDocument.from(new DynamoDB());

const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`,
  DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`;

export const handler = async (event: any = {}): Promise<any> => {

  let Id = event?.pathParameters?.id || "" 
  const method = event.httpMethod; 
  
  if (!method) {
    return { statusCode: 400, body: 'invalid request, you are missing the http method' };
  }

  if (method === 'GET') {
      if(Id){ // get one
        try {
          const response = await db.get({
            TableName: TABLE_NAME,
            Key: {
              [PRIMARY_KEY]: Id
            }
          });
          if (response.Item) {
              return { statusCode: 200, body: JSON.stringify(response.Item) };
          } else {
              return { statusCode: 404 };
          }
        } catch (dbError) {
          return { statusCode: 500, body: JSON.stringify(dbError) };
        }
      }else { // get all
        try {
          const response = await db.scan({
            TableName: TABLE_NAME
          });
          return { statusCode: 200, body: JSON.stringify(response.Items) };
        } catch (dbError) {
          return { statusCode: 500, body: JSON.stringify(dbError) };
        }
      }
  } else if (method === "POST") { // update
    
    if (!event.body) { // Check valid body
      return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
    }
    
    const item = typeof event.body === 'object' ? event.body : JSON.parse(event.body);
    const editedItemProperties = Object.keys(item);
    if (!item || editedItemProperties.length < 1) {
      return { statusCode: 400, body: 'invalid request, no arguments provided' };
    }
   
    const params: any = {
      TableName: TABLE_NAME,
      Key: {
        [PRIMARY_KEY]: Id
      },
      UpdateExpression: `set`,
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
      ReturnValues: 'UPDATED_NEW'
    }

    Object.keys(item).forEach((property, index) => {
        params.ExpressionAttributeNames[`#${property}`] = property;
        params.UpdateExpression += `${index > 0 ? ', ' : ' '}#${property} = :${property}`;
        params.ExpressionAttributeValues[`:${property}`] = item[property];
    });
    
    try {
      await db.update(params);
      return { statusCode: 204, body: '' };
    } catch (dbError) {
      console.log(dbError, "dbError")
      const errorResponse = dbError.code === 'ValidationException' && dbError.message.includes('reserved keyword') ?
        RESERVED_RESPONSE : DYNAMODB_EXECUTION_ERROR;
      return { statusCode: 500, body: errorResponse };
    }
    
  } else if (method === "PUT") { // create
   
    if (!event.body) {
      return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
    }
    const item = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
    item[PRIMARY_KEY] = uuidv4();
    const params = {
      TableName: TABLE_NAME,
      Item: item
    };

    try {
      await db.put(params);
      return { statusCode: 201, body: '' };
    } catch (dbError) {
      const errorResponse = dbError.code === 'ValidationException' && dbError.message.includes('reserved keyword') ?
        RESERVED_RESPONSE : DYNAMODB_EXECUTION_ERROR;
      return { statusCode: 500, body: errorResponse };
    }
      
  } else if (method === "DELETE"){
   
    if (!Id) {
      return { statusCode: 400, body: `Error: You are missing the path parameter id` };
    }
  
    const params = {
      TableName: TABLE_NAME,
      Key: {
        [PRIMARY_KEY]: Id
      }
    };
  
    try {
      await db.delete(params);
      return { statusCode: 200, body: '' };
    } catch (dbError) {
      return { statusCode: 500, body: JSON.stringify(dbError) };
    }
    
  } else {
    return { statusCode: 400, body: 'invalid request http undefine' };
  }
  // else if( method === "PATCH"){
      
  // } 
};