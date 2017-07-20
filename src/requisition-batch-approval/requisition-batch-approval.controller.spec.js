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

describe('RequisitionBatchApprovalController', function () {

    //injects
    var vm, $stateParams, $rootScope, $q, confirmService, $controller, calculationFactory,
        confirmDeferred, $scope, requisitionService, requisitionStatus, alertService, $state,
        localStorageFactory;

    //variables
    var requisitions, products, lineItems;

    beforeEach(function() {
        module('requisition-batch-approval');

        var requisitionLineItems = [
            {
                id: 1,
                skipped: false,
                approvedQuantity: 10,
                totalCost: 100,
                orderable: {
                    id: 1,
                    productCode: 'Code 1',
                    fullProductName: 'Product name 1'
                }
            },
            {
                id: 2,
                skipped: false,
                approvedQuantity: 1,
                totalCost: 10,
                orderable: {
                    id: 2,
                    productCode: 'Code 2',
                    fullProductName: 'Product name 2'
                }
            }
        ];

        var requisition = {
            id: 1,
            status: 'AUTHORIZED',
            requisitionLineItems: requisitionLineItems,
            processingPeriod: {
                name: 'Period name 1'
            },
            facility: {
                name: 'Facility name 1'
            }
        };

        requisitions = [requisition];

        products = {};
        products[requisitionLineItems[0].orderable.id] = {
            code: requisitionLineItems[0].orderable.productCode,
            name: requisitionLineItems[0].orderable.fullProductName,
            totalCost: requisitionLineItems[0].totalCost,
            totalQuantity: requisitionLineItems[0].approvedQuantity,
            requisitions: [requisition.id]
        };
        products[requisitionLineItems[1].orderable.id] = {
            code: requisitionLineItems[1].orderable.productCode,
            name: requisitionLineItems[1].orderable.fullProductName,
            totalCost: requisitionLineItems[1].totalCost,
            totalQuantity: requisitionLineItems[1].approvedQuantity,
            requisitions: [requisition.id]
        };

        lineItems = [];
        lineItems[requisition.id] = [];
        lineItems[requisition.id][requisitionLineItems[0].orderable.id] = requisitionLineItems[0];
        lineItems[requisition.id][requisitionLineItems[1].orderable.id] = requisitionLineItems[1];

        var requisitionWatcherMock = jasmine.createSpy('RequisitionWatcher');
        module(function($provide){
            $provide.factory('RequisitionWatcher', function() {
                return requisitionWatcherMock;
            });
        });

        inject(function (_$controller_, _confirmService_, _$rootScope_, _$q_, _requisitionService_,
                         _$stateParams_, _REQUISITION_STATUS_, _alertService_, _$state_) {
            $controller = _$controller_;
            confirmService = _confirmService_;
            $rootScope = _$rootScope_;
            $q = _$q_;
            $scope = _$rootScope_.$new();
            requisitionService = _requisitionService_;
            requisitionStatus = _REQUISITION_STATUS_;
            $stateParams = _$stateParams_;
            alertService = _alertService_;
            $state = _$state_;

        });

        $stateParams.errors = {};
        calculationFactory = jasmine.createSpyObj('calculationFactory', ['totalCost']);
        calculationFactory.totalCost.andReturn(100);
        spyOn(requisitionService, 'get').andReturn($q.when(requisition));
    });

    describe('$onInit', function() {

        beforeEach(function() {
            $stateParams.errors[requisitions[0].id] = "There was an error";

            vm = $controller('RequisitionBatchApprovalController', {
                requisitions: requisitions,
                $scope: $scope,
                $stateParams: $stateParams
            });
        });

        it('should expose requisitions', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.requisitions).toEqual(requisitions);
        });

        it('should assign errors to requisitions', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.requisitions[0].$error).toEqual("There was an error");
        });

        it('should calculate total cost of requisition', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.requisitions[0].$totalCost).toEqual(110);
        });

        it('should calculate total cost of all requisitions', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.totalCost).toEqual(110);
        });

        it('should expose list of products', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.products).toEqual(products);
        });

        it('should expose list of line items', function() {
            vm.$onInit();
            $rootScope.$apply();
            expect(vm.lineItems).toEqual(lineItems);
        });
    });

    describe('updateLineItem', function() {

        beforeEach(function() {
            initController();
        });

        it('should call calculation factory method', function() {
            vm.updateLineItem(lineItems[1][1], requisitions[0]);

            expect(calculationFactory.totalCost).toHaveBeenCalled();
            expect(lineItems[1][1].totalCost).toBe(100);
        });
    });

    describe('revert', function() {

        beforeEach(function() {
            initController();

            confirmDeferred = $q.defer();
            spyOn(confirmService, 'confirm').andReturn(confirmDeferred.promise);
        });

        it('should ask user for confirmation', function() {
            vm.revert();

            confirmDeferred.resolve();
            $rootScope.$apply();

            expect(confirmService.confirm).toHaveBeenCalledWith(
                'requisitionBatchApproval.revertConfirm', 'requisitionBatchApproval.revert');
        });

        it('should revert requisitions to original state', function() {
            vm.requisitions[0].requisitionLineItems[0].approvedQuantity = 1000;

            vm.revert();
            confirmDeferred.resolve();
            $rootScope.$apply();

            expect(vm.requisitions[0].requisitionLineItems[0].approvedQuantity).toBe(10);
            expect(vm.requisitions).toEqual(vm.requisitionsCopy);
        });
    });

    describe('isInApproval', function() {

        beforeEach(function() {
            initController();
        });

        it('should return true if in approval', function() {
            vm.requisitions[0].status = requisitionStatus.IN_APPROVAL;

            expect(vm.isInApproval(vm.requisitions[0])).toBe(true);
        });

        it('should return false if not in approval', function() {
            vm.requisitions[0].status = requisitionStatus.AUTHORIZED;

            expect(vm.isInApproval(vm.requisitions[0])).toBe(false);
        });
    });

    describe('updateRequisitions', function() {
        var isOffline;

        beforeEach(function() {
            isOffline = false;
            initController();

            spyOn($state, 'reload');
            spyOn(alertService, 'error');

            spyOn(vm, 'isOffline').andCallFake(function(){
                return isOffline;
            });

            confirmDeferred = $q.defer();
            spyOn(confirmService, 'confirm').andReturn(confirmDeferred.promise);
        });

        it('should display alert if offline', function() {
            isOffline = true;
            vm.updateRequisitions();

            expect(alertService.error).toHaveBeenCalledWith('requisitionBatchApproval.updateOffline');
        });

        it('should ask user for confirmation to update', function() {
            vm.updateRequisitions();

            confirmDeferred.resolve();
            $rootScope.$apply();

            expect(confirmService.confirm).toHaveBeenCalledWith(
                'requisitionBatchApproval.updateWarning', 'requisitionBatchApproval.update');
        });

        it('should reload current state', function() {
            vm.updateRequisitions();

            confirmDeferred.resolve();
            $rootScope.$apply();

            expect($state.reload).toHaveBeenCalled();
        });
    });

    describe('areRequisitionsOutdated', function() {

        beforeEach(function() {
            initController();
        });

        it('should return true if at least one requisition is marked as outdated', function() {
            vm.requisitions[0].$outdated = true;

            expect(vm.areRequisitionsOutdated()).toBeTruthy();
        });

        it('should return false if all requisitions are up to date', function() {
            expect(vm.areRequisitionsOutdated()).toBeFalsy();
        });

    });


    function initController() {
        vm = $controller('RequisitionBatchApprovalController', {
            requisitions: requisitions,
            calculationFactory: calculationFactory,
            $scope: $scope,
            $stateParams: $stateParams
        });
        vm.$onInit();
        $rootScope.$apply();
    }
});
