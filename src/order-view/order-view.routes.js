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

  angular
  .module('order-view')
  .config(config);

  config.$inject = ['$stateProvider', 'FULFILLMENT_RIGHTS'];

  // Malawi: min start date
  var minStartDate = '2017-07-01';
  // --- ends here ---

  function config($stateProvider, FULFILLMENT_RIGHTS) {

    $stateProvider.state('openlmis.orders.view', {
      controller: 'OrderViewController',
      controllerAs: 'vm',
      label: 'orderView.viewOrders',
      showInNavigation: true,
      templateUrl: 'order-view/order-view.html',
      url: '/view?supplyingFacility&requestingFacility&program&periodStartDate&periodEndDate&page&size',
      accessRights: [
        FULFILLMENT_RIGHTS.PODS_MANAGE,
        FULFILLMENT_RIGHTS.ORDERS_VIEW
      ],
      areAllRightsRequired: false,
      resolve: {
        supplyingFacilities: function(facilityFactory, authorizationService) {
          return facilityFactory.getSupplyingFacilities(
              authorizationService.getUser().user_id
          );
        },
        requestingFacilities: function(requestingFacilityFactory, $stateParams) {
          if ($stateParams.supplyingFacility) {
            return requestingFacilityFactory.loadRequestingFacilities(
                $stateParams.supplyingFacility).then(function(requestingFacilities) {
              return requestingFacilities;
            });
          }
          return undefined;
        },
        programs: function(programService, authorizationService) {
          return programService.getAll();
        },
        orders: function(paginationService, orderFactory, $stateParams) {
          return paginationService.registerUrl($stateParams, function(stateParams) {
            var params = angular.copy(stateParams);
            // Malawi: min start date
            if (!params.periodStartDate
                || new Date(params.periodStartDate) < new Date(minStartDate)) {
              params.periodStartDate = minStartDate;
            }
            // --- ends here ---
            if (params.supplyingFacility) {
              return orderFactory.search(params);
            }
            return undefined;
          });
        }
      }
    });

  }

})();
