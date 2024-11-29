pipeline {
    agent {
        kubernetes {
            yaml """
            apiVersion: v1
            kind: Pod
            metadata:
              namespace: default
            spec:
              serviceAccountName: jenkins-deployer
              containers:
              - name: jenkins-agent
                image: jenkins/inbound-agent:latest
                command:
                - cat
                tty: true
                securityContext:
                  privileged: true
              - name: docker
                image: docker:dind
                securityContext:
                  privileged: true
                volumeMounts:
                - name: dind-storage
                  mountPath: /var/lib/docker
                env:
                - name: DOCKER_TLS_CERTDIR
                  value: ""
                - name: DOCKER_HOST
                  value: tcp://localhost:2375
              - name: helm
                image: alpine/helm:3.11.1
                command: ['cat']
                tty: true
              volumes:
              - name: dind-storage
                emptyDir: {}
            """
        }
    }
    environment {
        ECR_URL = '051826725870.dkr.ecr.eu-west-1.amazonaws.com'
        IMAGE_NAME = 'nestjs'
        IMAGE_TAG = 'latest'
        KUBE_NAMESPACE = 'default'
        AWS_CREDENTIALS = 'aws_credentials'
        AWS_REGION = 'eu-west-1'
        ECR_REPOSITORY = "${ECR_URL}/${IMAGE_NAME}"
        GIT_REPO = 'https://github.com/dadashussein/simple-node.git'
        GITHUB_REPO = 'https://github.com/dadashussein/simple-node.git'
        GITHUB_BRANCH = 'main'
        HELM_CHART_NAME = 'simple-node'
    }
    stages {
        stage('Checkout Dockerfile') {
            steps {
                git url: "${GITHUB_REPO}", branch: "${GITHUB_BRANCH}"
            }
         }       
        stage('Prepare Docker') {
            steps {
                container('docker') {
                    sh 'dockerd-entrypoint.sh &>/dev/null &'
                    sh 'sleep 20'
                    sh 'apk add --no-cache aws-cli kubectl'
                    sh 'aws --version'
                    sh 'docker --version'
                    sh 'kubectl version --client'
                }
            }
        }
        stage('Application Build') {
            steps {
                container('docker') {
                    sh "docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} ."
                }
            }
        }
        stage('Create ECR Secret') {
            steps {
                container('docker') {
                    withCredentials([aws(credentialsId: "${AWS_CREDENTIALS}")]) {
                        sh """
                        aws ecr get-login-password --region \${AWS_REGION} | docker login --username AWS --password-stdin \${ECR_REPOSITORY}
                        kubectl create secret generic ecr-secret --namespace=default --from-file=.dockerconfigjson=\$HOME/.docker/config.json --dry-run=client -o json | kubectl apply -f -
                        """
                    }
                }
            }
        }
        stage('Push Docker Image to ECR') {
            steps {
                script {
                    if (currentBuild.result != 'FAILURE') {
                        env.PUSH_SUCCESSFUL = true
                    } else {
                        env.PUSH_SUCCESSFUL = false
                        }
                    container('docker') {
                        withCredentials([aws(credentialsId: "${AWS_CREDENTIALS}")]) {
                            sh """
                            aws ecr get-login-password --region ${AWS_REGION} | docker login -u AWS --password-stdin ${ECR_REPOSITORY}
                            """
                        }
                        // Push Docker image to ECR
                        sh "docker push ${ECR_REPOSITORY}:${IMAGE_TAG}"
                    }
                }
            }
        }
        stage('Deploy to Kubernetes with Helm') {
            steps {
                container('helm') {
                    sh """
                    helm upgrade --install ${HELM_CHART_NAME}  ./helm-chart \\
                        --set image.repository=${ECR_REPOSITORY} \\
                        --set image.tag=${IMAGE_TAG} \\
                        -f ./helm-chart/values.yaml \\
                        --namespace default
                    """
                }
            }
        }
    }
}
