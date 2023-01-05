import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';


//SSM Parameter imports
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface ECSStackProps extends StackProps {
    vpc: ec2.Vpc
    dbSecretArn: string
}

export class ECSStack extends Stack {

    constructor(scope: App, id: string, props: ECSStackProps) {
        super(scope, id, props);

        const containerPort = this.node.tryGetContext("containerPort");
        const containerImage = this.node.tryGetContext("containerImage");
        const creds = secretsmanager.Secret.fromSecretCompleteArn(this, 'postgresCreds', props.dbSecretArn);

        //fetch existing parameter from parameter store securely
        const DEMOPARAM = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'demo_param', {
            parameterName: 'DEMO_PARAMETER',
            version: 1
        });

        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc: props.vpc,
            clusterName: 'fargateClusterDemo'
        });

        const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "fargateService", {
            cluster,
            taskImageOptions: {
                image: ecs.ContainerImage.fromRegistry(containerImage),
                containerPort: containerPort,
                enableLogging: true,
                secrets: {
                    POSTGRES_DATA: ecs.Secret.fromSecretsManager(creds),
                    //Inject parameters value securely
                    DEMO_PARAMETER: ecs.Secret.fromSsmParameter(DEMOPARAM),
                },
            },
            desiredCount: 1,
            publicLoadBalancer: true,
            serviceName: 'fargateServiceDemo'
        });

        new CfnOutput(this, 'LoadBalancerDNS', { value: fargateService.loadBalancer.loadBalancerDnsName });
    }
}