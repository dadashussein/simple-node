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
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT.substring(0, 7)}"
        IMAGE_TAG = "${GIT_COMMIT_SHORT}"
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
        stage('Checkout Code') {
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
        stage('Create or Update ECR Secret') {
            steps {
                container('docker') {
                    withCredentials([aws(credentialsId: "${AWS_CREDENTIALS}")]) {
                        sh """
                        aws ecr get-login-password --region \${AWS_REGION} | docker login --username AWS --password-stdin \${ECR_REPOSITORY}
                        if kubectl get secret ecr-secret -n \${KUBE_NAMESPACE}; then
                            kubectl delete secret ecr-secret -n \${KUBE_NAMESPACE}
                        fi
                        kubectl create secret generic ecr-secret --namespace=\${KUBE_NAMESPACE} --from-file=.dockerconfigjson=\$HOME/.docker/config.json
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
                    script {
                    if (sh(script: "helm history ${HELM_CHART_NAME} -n ${KUBE_NAMESPACE} 2>/dev/null | grep 'pending'", returnStatus: true) == 0) {
                        echo "Found pending operations. Uninstalling previous release..."
                        sh "helm uninstall ${HELM_CHART_NAME} -n ${KUBE_NAMESPACE} || true"
                        sh "sleep 10"
                    }

                echo "Deploying with Helm..."
                sh """
                timeout 60s helm upgrade --install ${HELM_CHART_NAME} ./helm-chart \
                    --set image.repository=${ECR_REPOSITORY} \
                    --set image.tag=${IMAGE_TAG} \
                    --set image.pullPolicy=Always \
                    -f ./helm-chart/values.yaml \
                    --namespace ${KUBE_NAMESPACE} \
                    --atomic \
                    --cleanup-on-fail \
                    --wait
                """
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
                    if (currentBuild.result == null || currentBuild.result == 'SUCCESS') {
                        echo "Deployment succeeded."
                    } else {
                        echo "Deployment failed."
                    }
                }
            }
        }
    }
}
