import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path'

export class DynamoDbLamdbaCRUDStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Init DynamoDB
    const dynamoTable = new Table(this, 'NhanVien', {
      partitionKey: {
        name: 'NhanVienId',
        type: AttributeType.STRING
      },
      tableName: 'NhanVien',
      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      //removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });
    
    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          'aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
        ],
      },
      depsLockFilePath: join(__dirname, "..", 'package-lock.json'),
      environment: {
        PRIMARY_KEY: 'NhanVienId',
        TABLE_NAME: dynamoTable.tableName,
      },
      runtime: Runtime.NODEJS_20_X,
    }
    
    // Tạo hàm lambda CRUD với table NhanVien
     const onCrudLambdaNhanVien = new NodejsFunction(this, 'onCrudNhanVienFunction', {
      entry: join(__dirname, ".." , 'lambdas', 'onCrudNhanVien.ts'),
      ...nodeJsFunctionProps,
    });
    
    // Gắn quyền CRUD cho lambda thao tác với table
    dynamoTable.grantReadWriteData(onCrudLambdaNhanVien);
    
    // tích hợp với Gateway API
    const crudNhanVienIntegration = new LambdaIntegration(onCrudLambdaNhanVien);
    
    // tạo Gateway API tích hợp với lamdba đã defi Intergration
    const api = new RestApi(this, 'NhanVienApi', {
      restApiName: 'Service Nhan Vien'
      // In case you want to manage binary types, uncomment the following
      // binaryMediaTypes: ["*/*"],
    });

    const items = api.root.addResource('NhanVien');
    items.addMethod('GET', crudNhanVienIntegration);
    items.addMethod('PUT', crudNhanVienIntegration);
    addCorsOptions(items);

    const singleItem = items.addResource('{id}');
    singleItem.addMethod('GET', crudNhanVienIntegration);
    singleItem.addMethod('POST', crudNhanVienIntegration);
    singleItem.addMethod('DELETE', crudNhanVienIntegration);
    addCorsOptions(singleItem);

  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    // In case you want to use binary media types, uncomment the following line
    // contentHandling: ContentHandling.CONVERT_TO_TEXT,
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    // In case you want to use binary media types, comment out the following line
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}
