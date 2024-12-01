# Simple Node.js Application with Jenkins CI/CD Pipeline

This repository contains a simple Node.js application with a complete CI/CD pipeline implemented using Jenkins, Docker, and Kubernetes.

## Pipeline Overview

The Jenkins pipeline automates the following processes:

1. **Unit Testing**: Executes Jest-based unit tests in a Node.js environment
2. **Security Scanning**: Performs code analysis using SonarQube
3. **Docker Image Building**: Creates and pushes Docker images to Amazon ECR
4. **Kubernetes Deployment**: Deploys the application to a Kubernetes cluster using Helm
5. **Verification**: Ensures the application is running correctly post-deployment
6. **Notifications**: Sends deployment status updates via Slack and email

## Prerequisites

- Jenkins server with following plugins:
  - Kubernetes
  - Docker
  - AWS
  - SonarQube
  - Slack Notification
  - Email Extension
- AWS ECR repository
- Kubernetes cluster
- SonarQube server
- Slack workspace

## Pipeline Configuration

### Environment Variables

- `ECR_URL`: Amazon ECR repository URL
- `IMAGE_NAME`: Docker image name
- `AWS_REGION`: AWS region for ECR
- `KUBE_NAMESPACE`: Kubernetes namespace
- `HELM_CHART_NAME`: Name of the Helm chart

### Jenkins Credentials Required

1. AWS credentials (aws_credentials)
2. SonarQube token
3. Slack token
4. Docker registry credentials

### Pipeline Stages

1. **Checkout**: Clones the repository
2. **Unit Tests**: Runs Jest tests
3. **SonarQube Analysis**: Performs code quality and security analysis
4. **Docker Build & Push**: Creates and pushes Docker image to ECR
5. **Kubernetes Deployment**: Deploys application using Helm
6. **Verification**: Validates deployment success
7. **Notifications**: Sends status updates

## Deployment Process

1. Push code changes to the repository
2. Jenkins automatically triggers the pipeline
3. Pipeline executes all stages
4. Application is deployed to Kubernetes
5. Verification ensures successful deployment
6. Status notifications are sent to stakeholders

## Monitoring and Maintenance

- Pipeline status can be monitored in Jenkins dashboard
- Deployment status notifications are sent to configured Slack channel
- Email notifications are sent to configured recipients
- Application health can be checked at `/health` endpoint

## Troubleshooting

If the pipeline fails:
1. Check Jenkins console output for specific stage failures
2. Verify AWS credentials and permissions
3. Ensure Kubernetes cluster is accessible
4. Check SonarQube server connectivity
5. Verify Slack/email notification configurations

For deployment rollbacks:
- Use `helm rollback` command
- Pipeline includes automatic rollback on failure
