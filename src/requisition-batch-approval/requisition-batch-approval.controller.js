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

(function() {

    'use strict';

    /**
     * @ngdoc controller
     * @name requisition-batch-approval.controller:RequisitionBatchApprovalController
     *
     * @description
     * Controller for approval list of requisitions.
     */

    angular
        .module('requisition-batch-approval')
        .controller('RequisitionBatchApprovalController', controller);

    controller.$inject = [
        'requisitions', 'calculationFactory', 'stateTrackerService', 'loadingModalService', 'messageService',
            'alertService', 'confirmService', 'notificationService', 'requisitionBatchSaveFactory',
            'requisitionBatchApproveFactory', 'offlineService', 'BatchRequisitionWatcher', '$scope', '$filter', 'REQUISITION_STATUS',
            'localStorageFactory', '$state', '$stateParams'
    ];

    function controller(requisitions, calculationFactory, stateTrackerService, loadingModalService,
                        messageService, alertService, confirmService, notificationService, requisitionBatchSaveFactory,
                        requisitionBatchApproveFactory, offlineService, BatchRequisitionWatcher, $scope, $filter, REQUISITION_STATUS,
                        localStorageFactory, $state, $stateParams) {

        var vm = this;

        vm.$onInit = onInit;
        vm.updateLineItem = updateLineItem;
        vm.revert = revert;
        vm.sync = sync;
        vm.approve = approve;
        vm.isInApproval = isInApproval;
        vm.updateRequisitions = updateRequisitions;
        vm.areRequisitionsOutdated = areRequisitionsOutdated;
        vm.isOffline = offlineService.isOffline;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name requisitions
         * @type {Array}
         *
         * @description
         * Holds requisitions that can be approved on the view.
         */
        vm.requisitions = undefined;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name errors
         * @type {Array}
         *
         * @description
         * Keeps a list of all current errors on the view.
         */
        vm.errors = [];

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name products
         * @type {Array}
         *
         * @description
         * Holds all products that should be displayed as rows in table. Each product from array contains its code and name,
         * information about total cost and quantity of product for all facilities,
         * and array of ids of requisitions that contain line item of this product.
         */
        vm.products = undefined;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name lineItems
         * @type {Array}
         *
         * @description
         * Holds all line items from all requisitions - each line item is identified by requisition id and product id.
         */
        vm.lineItems = undefined;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name totalCost
         * @type {Number}
         *
         * @description
         * Holds total cost of all products from all requisitions.
         */
        vm.totalCost = undefined;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name requisitionsCopy
         * @type {Array}
         *
         * @description
         * Holds copy of original requisitions that can be approved on the view.
         * It is used to provide 'revert' functionality.
         */
        vm.requisitionsCopy = undefined;

        /**
         * @ngdoc property
         * @propertyOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name columns
         * @type {Array}
         *
         * @description
         * Holds columns that will be displayed in the batch approval table.
         */
        vm.columns = [];

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name $onInit
         *
         * @description
         * Initialization method called after the controller has been created. Responsible for
         * setting data to be available on the view.
         */
        function onInit() {
            prepareDataToDisplay(requisitions);
        }

        function prepareDataToDisplay(requisitions) {
            vm.totalCost = 0;
            vm.requisitions = [];

            vm.products = {};
            vm.lineItems = [];
            vm.errors = [];
            vm.columns = [];

            addNewColumn(true, false, ['requisitionBatchApproval.productCode']);
            addNewColumn(true, false, ['requisitionBatchApproval.product']);

            angular.forEach(requisitions, function(requisition) {
                addNewColumn(false, false, ['requisitionBatchApproval.approvedQuantity', 'requisitionBatchApproval.cost'], requisition);
                vm.lineItems[requisition.id] = [];

                angular.forEach(requisition.requisitionLineItems, function(lineItem) {
                    vm.lineItems[requisition.id][lineItem.orderable.id] = lineItem;
                    lineItem.totalCost = lineItem.totalCost ? lineItem.totalCost : 0;
                    lineItem.approvedQuantity = lineItem.approvedQuantity ? lineItem.approvedQuantity : 0;

                    vm.totalCost += lineItem.totalCost;

                    if (vm.products[lineItem.orderable.id] !== undefined) {
                        vm.products[lineItem.orderable.id].requisitions.push(requisition.id);
                        vm.products[lineItem.orderable.id].totalCost += lineItem.totalCost;
                        vm.products[lineItem.orderable.id].totalQuantity += lineItem.approvedQuantity;
                    } else {
                        vm.products[lineItem.orderable.id] = {
                            code: lineItem.orderable.productCode,
                            name: lineItem.orderable.fullProductName,
                            totalCost: lineItem.totalCost,
                            totalQuantity: lineItem.approvedQuantity,
                            requisitions: [requisition.id]
                        };
                    }

                });

                //method used in calculation factory
                requisition.$isAfterAuthorize = isAfterAuthorize;
                calculateRequisitionTotalCost(requisition);

                //set errors to be displayed (needed when state is reloaded to update outdated requisitions)
                if ($stateParams.errors[requisition.id]) {
                    requisition.$error = $stateParams.errors[requisition.id];
                }

                new BatchRequisitionWatcher($scope, requisition);
                vm.requisitions.push(requisition);
            });

            addNewColumn(true, true, ['requisitionBatchApproval.totalQuantityForAllFacilities']);
            addNewColumn(true, true, ['requisitionBatchApproval.totalCostForAllFacilities']);

            //save copy to provide revert functionality
            vm.requisitionsCopy = angular.copy(vm.requisitions);
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name updateLineItem
         *
         * @description
         * Updates cost of line item, total cost of each product for all facilities
         * and total cost of all products for all facilities.
         */
        function updateLineItem(lineItem, requisition) {
            lineItem.totalCost = calculationFactory['totalCost'](lineItem, requisition);
            updateTotalValues(lineItem.orderable.id);
            calculateRequisitionTotalCost(requisition);
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name revert
         *
         * @description
         * Replaces all values manually entered by user with the values the page displayed when originally loaded.
         */
        function revert() {
            confirmService.confirm('requisitionBatchApproval.revertConfirm', 'requisitionBatchApproval.revert').then(function() {
                prepareDataToDisplay(vm.requisitionsCopy);
            });

        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name sync
         *
         * @description
         * Responsible for syncing requisitions with the server.
         */
        function sync() {
            loadingModalService.open();

            requisitionBatchSaveFactory(vm.requisitions)
            .then(function(savedRequisitions){
                //successfully saved all requisitions
                var successMessage = messageService.get("requisitionBatchApproval.syncSuccess", {
                    successCount: savedRequisitions.length
                });

                $stateParams.errors = {};
                prepareDataToDisplay(savedRequisitions);
                notificationService.success(successMessage);

            }, function(savedRequisitions) {
                //at least one requisition failed to save
                var errors = {},
                    successCount = savedRequisitions ? savedRequisitions.length : 0,
                    errorMessage = messageService.get("requisitionBatchApproval.syncError", {
                        errorCount: vm.requisitions.length - successCount
                    });

                angular.forEach(vm.requisitions, function(requisition){
                    var savedRequisition = $filter('filter')(savedRequisitions, {id: requisition.id});
                    if(savedRequisition[0] !== undefined) { // if successful requisition
                        requisition = savedRequisition[0];
                    } else {
                        errors[requisition.id] = requisition.$error;
                    }
                });

                notificationService.error(errorMessage);
                $state.go($state.current, {errors: errors}, {reload: true});
            })
            .finally(loadingModalService.close);
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name approve
         *
         * @description
         * Approves all displayed requisitions.
         */
        function approve() {
            confirmService.confirm('requisitionBatchApproval.approvalConfirm').then(function(){
                loadingModalService.open();

                // Using slice to make copy of array, so scope changes at end only
                requisitionBatchApproveFactory(vm.requisitions.slice())
                .then(handleApprove, handleApprove)
                .finally(loadingModalService.close);
            });
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name isInApproval
         *
         * @param {Object} requisition Requisition with status to check
         *
         * @return {boolean} true if requisition is in status IN_APPROVAL, false otherwise
         *
         * @description
         * Determines whether requisition is IN_APPROVAL status.
         */
        function isInApproval(requisition) {
            return requisition.status === REQUISITION_STATUS.IN_APPROVAL;
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name updateRequisitions
         *
         * @description
         * After confirming with the user, the outdated offline requisitions are removed,
         * and the state is reloaded. This will fetch a fresh version of the
         * requisitions.
         *
         * If the browser is offline, an error will be thrown, and nothing will
         * change.
         *
         */
        function updateRequisitions() {
            if(vm.isOffline()) {
                alertService.error('requisitionBatchApproval.updateOffline');
                return;
            }

            confirmService.confirm('requisitionBatchApproval.updateWarning', 'requisitionBatchApproval.update')
                .then(function(){
                    var offlineBatchRequisitions = localStorageFactory('batchApproveRequisitions'),
                        offlineRequisitions = localStorageFactory('requisitions');

                    angular.forEach(vm.requisitions, function(requisition) {
                        offlineBatchRequisitions.removeBy('id', requisition.id);
                        offlineRequisitions.removeBy('id', requisition.id)
                    });

                    $state.reload();
                });
        }

        /**
         * @ngdoc method
         * @methodOf requisition-batch-approval.controller:RequisitionBatchApprovalController
         * @name areRequisitionsOutdated
         *
         * @return {boolean} true if at least one requisition is outdated, false otherwise
         *
         * @description
         * Checks if there are outdated offline requisitions displayed on the page in
         * order to display proper warning.
         *
         */
        function areRequisitionsOutdated() {
            return $filter('filter')(vm.requisitions, {$outdated: true}).length > 0;
        }

        function handleApprove(successfulRequisitions) {

            if(successfulRequisitions.length < vm.requisitions.length) {
                var errors = {};

                //Not all requisitions got approved, remove all successful requisitions
                vm.requisitions = _.filter(vm.requisitions, function(requisition){
                    return requisition.$error;
                });

                angular.forEach(vm.requisitions, function(requisition) {
                    errors[requisition.id] = requisition.$error;

                });

                if (successfulRequisitions.length > 0) {
                    notificationService.success(
                        messageService.get("requisitionBatchApproval.approvalSuccess", {
                            successCount: successfulRequisitions.length
                        })
                    );
                }

                notificationService.error(
                    messageService.get("requisitionBatchApproval.approvalError", {
                        errorCount: vm.requisitions.length
                    })
                );

                // Reload state to display page without approved notifications and to update outdated ones
                $state.go($state.current, {errors: errors, ids: Object.keys(errors).join(',')}, {reload: true});
            } else {

                //All requisitions got approved, display notification and go back to approval list
                notificationService.success(
                    messageService.get("requisitionBatchApproval.approvalSuccess", {
                        successCount: successfulRequisitions.length
                    })
                );

                stateTrackerService.goToPreviousState('openlmis.requisitions.approvalList');
            }
        }

        function calculateRequisitionTotalCost(requisition) {
            requisition.$totalCost = 0;
            angular.forEach(requisition.requisitionLineItems, function(lineItem) {
                requisition.$totalCost += lineItem.totalCost;
            });
        }

        function updateTotalValues(productId) {
            vm.products[productId].totalCost = 0;
            vm.products[productId].totalQuantity = 0;
            vm.totalCost = 0;

            angular.forEach(vm.requisitions, function(requisition) {
                angular.forEach(requisition.requisitionLineItems, function(lineItem) {
                    vm.totalCost += lineItem.totalCost;
                    if (lineItem.orderable.id === productId) {
                        vm.products[productId].totalCost += lineItem.totalCost;
                        vm.products[productId].totalQuantity += lineItem.approvedQuantity;
                    }
                });
            });
        }

        function addNewColumn(isSticky, isStickyRight, names, requisition) {
            vm.columns.push({
                id: requisition ? requisition.id : vm.columns.length,
                requisition: requisition,
                sticky: isSticky,
                right: isStickyRight,
                names: names
            });
        }

        // Requisitions in this view are always IN_APPROVAL or AUTHORIZED so always return true
        function isAfterAuthorize() {
            return true;
        }
    }

})();
