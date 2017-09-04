/*
 * This program is part of the OpenLMIS logistics management information system platform software.
 * Copyright © 2017 VillageReach
 *
 * This program is free software: you can redistribute it and/or modify it under the terms
 * of the GNU Affero General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *  
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
 * See the GNU Affero General Public License for more details. You should have received a copy of
 * the GNU Affero General Public License along with this program. If not, see
 * http://www.gnu.org/licenses.  For additional information contact info@OpenLMIS.org. 
 */

(function(){
    'use strict';

    /**
     * @ngdoc service
     * @name openlmis-login.loginService
     *
     * @description
     * Facilitates the login process between the OpenLMIS Server and the UI client.
     * This service works with the authorizationService, which is responsible for storing implementation details.
     * This service has one difference from the core code - it gets currency settings from UI config file,
     * instead of backend.
     */
    angular
        .module('openlmis-login')
        .service('loginService', loginService);

    loginService.$inject = ['$rootScope', '$q', '$http', 'authUrl', 'openlmisUrlFactory', 'authorizationService',
                            'Right', '$state', 'currencyService', 'offlineService'];

    function loginService($rootScope, $q, $http, authUrl, openlmisUrlFactory, authorizationService,
                            Right, $state, currencyService, offlineService) {

        this.login = login;
        this.logout = logout;
        this.forgotPassword = forgotPassword;
        this.changePassword = changePassword;

        function authorizationHeader(){
            var data = btoa('@@AUTH_SERVER_CLIENT_ID' + ':' + '@@AUTH_SERVER_CLIENT_SECRET');
            return 'Basic ' + data;
        }

        /**
         * @ngdoc method
         * @methodOf openlmis-login.loginService
         * @name login
         *
         * @description
         * Makes an HTTP request to login the user while online.
         *
         * This method returns a function that will return a promise with no value.
         *
         * @param {String} username The name of the person trying to login
         * @param {String} password The password the person is trying to login with
         */
        function login(username, password) {
            var deferred = $q.defer(),
                httpPromise = $http({
                    method: 'POST',
                    url: authUrl('/api/oauth/token?grant_type=password'),
                    data: 'username=' + username + '&password=' + password,
                    headers: {
                        'Authorization': authorizationHeader(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

            httpPromise.then(function(response) {
                authorizationService.setAccessToken(response.data.access_token);
                getUserInfo(response.data.referenceDataUserId).then(function(referencedataUsername) {
                    getUserRights(response.data.referenceDataUserId).then(function(userRights) {
                        authorizationService.saveOfflineUserData(username, response.data.referenceDataUserId, referencedataUsername, userRights);
                        currencyService.getCurrencySettingsFromConfig();
                        deferred.resolve();
                    }, function(){
                        authorizationService.clearAccessToken();
                        deferred.reject();
                    });
                }, function(){
                    authorizationService.clearAccessToken();
                    deferred.reject();
                });
            });
            httpPromise.catch(function(response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        /**
         * @ngdoc method
         * @methodOf openlmis-login.loginService
         * @name logout
         *
         * @description
         * Calls the server if online, then removes user data from
         * authorization service.
         */
        function logout() {
            $rootScope.$emit('openlmis-auth.logout');
            if(offlineService.isOffline()) {
                return logoutOffline();
            }
            return logoutOnline();
        }


        function logoutOnline(){
            var deferred = $q.defer();
            $http({
                method: 'POST',
                url: authUrl('/api/users/auth/logout'),
                ignoreAuthModule: true
            }).then(function() {
                clearUserData();
                deferred.resolve();
            }, function(data) {
                if (data.status === 401) {
                    clearUserData();
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            });
            return deferred.promise;
        }

        function logoutOffline() {
            authorizationService.clearAccessToken();
            authorizationService.clearUser();
            authorizationService.clearRights();

            return $q.resolve();
        }

        function getUserInfo(userId){
            var deferred = $q.defer();
            if(!authorizationService.isAuthenticated()) {
                deferred.reject();
            } else {
                var userInfoURL = authUrl(
                    '/api/users/' + userId
                );
                $http({
                    method: 'GET',
                    url: userInfoURL,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(function(response) {
                    authorizationService.setUser(userId, response.data.username);
                    //getUserRights(userId);
                    deferred.resolve(response.data.username);
                }).catch(function() {
                    deferred.reject();
                });
            }
            return deferred.promise;
        }

        function getUserRights(userId) {
            var deferred = $q.defer();

            if(!authorizationService.isAuthenticated()) {
                deferred.reject();
            } else {
                var userRoleAssignmentsURL = openlmisUrlFactory(
                    '/api/users/' + userId + '/roleAssignments'
                );
                $http({
                    method: 'GET',
                    url: userRoleAssignmentsURL,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(function(response) {
                    var rights = Right.buildRights(response.data);
                    authorizationService.setRights(rights);
                    deferred.resolve(rights);
                }).catch(function() {
                    deferred.reject();
                });
            }
            return deferred.promise;
        }

        /**
         * @ngdoc method
         * @methodOf openlmis-login.loginService
         * @name forgotPassword
         *
         * @description
         * Calls the server that sends message with reset password link to given email address.
         *
         * @param  {String}  email Mail address where reset password link will be sent
         * @return {Promise}       Forgot password promise
         */
        function forgotPassword(email) {
            var forgotPasswordURL = openlmisUrlFactory('/api/users/auth/forgotPassword?email=' + email);

            return $http({
                method: 'POST',
                url: forgotPasswordURL,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        /**
         * @ngdoc method
         * @methodOf openlmis-login.loginService
         * @name changePassword
         *
         * @description
         * Calls the server that changes user account password.
         *
         * @param  {String}  newPassword New password for user account
         * @param  {String}  token       Token that identifies user
         * @return {Promise}             Resolves when password is changed successfully.
         */
        function changePassword(newPassword, token) {
            var changePasswordURL = openlmisUrlFactory('/api/users/auth/changePassword'),
                data = {
                    token: token,
                    newPassword: newPassword
                };

            if(authorizationService.isAuthenticated())
                authorizationService.clearAccessToken();

            return $http({
                method: 'POST',
                url: changePasswordURL,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        function clearUserData() {
            authorizationService.clearAccessToken();
            authorizationService.clearUser();
            authorizationService.clearRights();
        }
    }

})();
