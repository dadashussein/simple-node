pipeline {
    agent any

    environment {
        REPO_URL = 'https://github.com/dadashussein/simple-node.git' // GitHub repository URL
        DOCKER_IMAGE = 'simple-app'             // Docker image name
        DOCKER_REGISTRY = 'registry.digitalocean.com/dadas'  // Digital Ocean Container Registry
        KUBE_NAMESPACE = 'default'                                  // Kubernetes namespace
        HELM_CHART_PATH = './helm/nodejs-app'                       // Helm chart path
    }

    stages {
        stage('Clone Repository') {
            steps {
                git branch: 'main', url: "${REPO_URL}"
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    dockerImage = docker.build("${DOCKER_IMAGE}:latest")
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'digital-ocean-credentials') {
                        dockerImage.push("latest")
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                script {
                    sh """
                    helm upgrade --install nodejs-app ${HELM_CHART_PATH} \
                        --namespace ${KUBE_NAMESPACE} \
                        --set image.repository=${DOCKER_IMAGE} \
                        --set image.tag=latest
                    """
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline successfully completed!'
        }
        failure {
            echo 'Pipeline failed. Please check the logs for more details.'
        }
    }
}
