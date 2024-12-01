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
    triggers {
        githubPush()
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
        SONAR_PROJECT_KEY = 'simple-node'
        SLACK_CHANNEL = '#deployments'
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
        stage('SonarQube Analysis') {
            steps {
                container('docker') {
                    withSonarQubeEnv('SonarQube') {
                        sh '''
                            docker run --rm \
                                -e SONAR_HOST_URL=$SONAR_HOST_URL \
                                -e SONAR_LOGIN=$SONAR_AUTH_TOKEN \
                                -v "${WORKSPACE}:/usr/src" \
                                sonarsource/sonar-scanner-cli:latest \
                                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                -Dsonar.sources=. \
                                -Dsonar.host.url=$SONAR_HOST_URL
                        '''
                    }
                    timeout(time: 2, unit: 'MINUTES') {
                        waitForQualityGate abortPipeline: true
                    }
                }
            }
        }
        stage('Create ECR Secret') {
            steps {
                container('docker') {
                    withCredentials([aws(credentialsId: "${AWS_CREDENTIALS}")]) {
                        sh """
                        aws ecr get-login-password --region \${AWS_REGION} | docker login --username AWS --password-stdin \${ECR_REPOSITORY}
                        kubectl create secret generic ecr-secret --namespace=\${KUBE_NAMESPACE} --from-file=.dockerconfigjson=\$HOME/.docker/config.json --dry-run=client -o json | kubectl apply -f -
                        """
                    }
                }
            }
        }
        stage('Push Docker Image to ECR') {
            steps {
                container('docker') {
                    withCredentials([aws(credentialsId: "${AWS_CREDENTIALS}")]) {
                        sh "aws ecr get-login-password --region ${AWS_REGION} | docker login -u AWS --password-stdin ${ECR_REPOSITORY}"
                        sh "docker push ${ECR_REPOSITORY}:${IMAGE_TAG}"
                    }
                }
            }
        }
        stage('Deploy to Kubernetes with Helm') {
            steps {
                container('helm') {
                    sh """
                    # Check for any existing Helm operations
                    if helm history ${HELM_CHART_NAME} -n ${KUBE_NAMESPACE} 2>/dev/null | grep 'pending'; then
                        echo "Found pending operations. Attempting to rollback..."
                        helm rollback ${HELM_CHART_NAME} 0 -n ${KUBE_NAMESPACE} || true
                        sleep 10
                    fi

                    # Attempt the upgrade with a timeout
                    timeout 300s helm upgrade --install ${HELM_CHART_NAME} ./helm-chart \
                        --set image.repository=${ECR_REPOSITORY} \
                        --set image.tag=${IMAGE_TAG} \
                        -f ./helm-chart/values.yaml \
                        --namespace ${KUBE_NAMESPACE} \
                        --atomic \
                        --cleanup-on-fail \
                        --wait
                    """
                }
            }
        }
        stage('Verify Deployment') {
            steps {
                container('docker') {
                    script {
                        sh '''
                            # Wait for pods to be ready
                            kubectl wait --for=condition=ready pod -l app=simple-node --timeout=300s
                            
                            # Get service URL
                            SERVICE_IP=$(kubectl get svc simple-node -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                            
                            # Verify application response
                            for i in {1..30}; do
                                if curl -s http://${SERVICE_IP}:3000/ | grep -q "Salam Rolls!"; then
                                    echo "Application verification successful!"
                                    exit 0
                                fi
                                sleep 10
                            done
                            echo "Application verification failed!"
                            exit 1
                        '''
                    }
                }
            }
        }
        stage('Clean Up Docker') {
            steps {
                container('docker') {
                    sh """
                    docker system prune -af || true
                    docker volume prune -f || true
                    """
                }
            }
        }
        stage('Rollback Deployment') {
            when {
                expression { currentBuild.result == 'FAILURE' }
            }
            steps {
                container('helm') {
                    sh "helm rollback ${HELM_CHART_NAME} 1 || echo 'No previous release to rollback'"
                }
            }
        }
        stage('Notifications') {
            steps {
                script {
                    def buildStatus = currentBuild.result ?: 'SUCCESS'
                    def message = """
                        Pipeline: ${env.JOB_NAME}
                        Status: ${buildStatus}
                        Build: ${env.BUILD_NUMBER}
                        Details: ${env.BUILD_URL}
                    """
                    
                    slackSend(
                        channel: SLACK_CHANNEL,
                        color: buildStatus == 'SUCCESS' ? 'good' : 'danger',
                        message: message
                    )
                    
                    emailext(
                        subject: "Pipeline Status: ${buildStatus}",
                        body: message,
                        recipientProviders: [[$class: 'DevelopersRecipientProvider']],
                        to: '$DEFAULT_RECIPIENTS'
                    )
                }
            }
        }
    }
}